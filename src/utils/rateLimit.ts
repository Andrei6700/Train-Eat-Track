/**
 * Rate limiting utility to prevent brute force attacks
 * Uses AsyncStorage to track failed login attempts
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const RATE_LIMIT_KEY = "auth_rate_limit";
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

type RateLimitData = {
  attempts: number;
  firstAttemptTime: number;
  lockedUntil: number | null;
};

/**
 * Get rate limit data from storage
 */
const getRateLimitData = async (): Promise<RateLimitData> => {
  try {
    const data = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    if (!data) {
      return {
        attempts: 0,
        firstAttemptTime: Date.now(),
        lockedUntil: null,
      };
    }
    return JSON.parse(data);
  } catch (error) {
    console.error("[RateLimit] Error reading rate limit data:", error);
    return {
      attempts: 0,
      firstAttemptTime: Date.now(),
      lockedUntil: null,
    };
  }
};

/**
 * Save rate limit data to storage
 */
const saveRateLimitData = async (data: RateLimitData): Promise<void> => {
  try {
    await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("[RateLimit] Error saving rate limit data:", error);
  }
};

/**
 * Check if authentication is rate limited
 * @returns object with isLocked status and time remaining if locked
 */
export const checkAuthRateLimit = async (): Promise<{
  isLocked: boolean;
  remainingTimeMs: number;
  message?: string;
}> => {
  const data = await getRateLimitData();
  const now = Date.now();

  // Check if account is locked
  if (data.lockedUntil && data.lockedUntil > now) {
    const remainingTimeMs = data.lockedUntil - now;
    const remainingMinutes = Math.ceil(remainingTimeMs / 60000);
    return {
      isLocked: true,
      remainingTimeMs,
      message: `Too many failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
    };
  }

  // Reset if lockout period has passed
  if (data.lockedUntil && data.lockedUntil <= now) {
    await saveRateLimitData({
      attempts: 0,
      firstAttemptTime: now,
      lockedUntil: null,
    });
    return { isLocked: false, remainingTimeMs: 0 };
  }

  // Reset if attempt window has passed
  if (now - data.firstAttemptTime > ATTEMPT_WINDOW_MS) {
    await saveRateLimitData({
      attempts: 0,
      firstAttemptTime: now,
      lockedUntil: null,
    });
    return { isLocked: false, remainingTimeMs: 0 };
  }

  return { isLocked: false, remainingTimeMs: 0 };
};

/**
 * Record a failed authentication attempt
 */
export const recordFailedAuthAttempt = async (): Promise<void> => {
  const data = await getRateLimitData();
  const now = Date.now();

  // If this is a new window, reset
  if (now - data.firstAttemptTime > ATTEMPT_WINDOW_MS) {
    await saveRateLimitData({
      attempts: 1,
      firstAttemptTime: now,
      lockedUntil: null,
    });
    return;
  }

  // Increment attempts
  const newAttempts = data.attempts + 1;

  // Lock account if max attempts reached
  if (newAttempts >= MAX_ATTEMPTS) {
    await saveRateLimitData({
      attempts: newAttempts,
      firstAttemptTime: data.firstAttemptTime,
      lockedUntil: now + LOCKOUT_DURATION_MS,
    });
    console.warn(`[RateLimit] Account locked due to ${newAttempts} failed attempts`);
  } else {
    await saveRateLimitData({
      attempts: newAttempts,
      firstAttemptTime: data.firstAttemptTime,
      lockedUntil: null,
    });
  }
};

/**
 * Record a successful authentication (resets rate limit)
 */
export const recordSuccessfulAuth = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(RATE_LIMIT_KEY);
  } catch (error) {
    console.error("[RateLimit] Error clearing rate limit:", error);
  }
};

/**
 * Get remaining attempts before lockout
 */
export const getRemainingAttempts = async (): Promise<number> => {
  const data = await getRateLimitData();
  const now = Date.now();

  // If outside attempt window, full attempts available
  if (now - data.firstAttemptTime > ATTEMPT_WINDOW_MS) {
    return MAX_ATTEMPTS;
  }

  return Math.max(0, MAX_ATTEMPTS - data.attempts);
};

/**
 * Clear all rate limit data (for testing or admin purposes)
 */
export const clearAuthRateLimit = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(RATE_LIMIT_KEY);
    console.log("[RateLimit] Rate limit data cleared");
  } catch (error) {
    console.error("[RateLimit] Error clearing rate limit:", error);
  }
};
