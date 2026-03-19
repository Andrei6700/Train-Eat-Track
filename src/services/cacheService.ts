import { DailyNutrition, Food, WorkoutHistory, WorkoutPlan } from "@/src/types/index";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ==================== KEYS ====================
const CACHE_KEYS = {
  LAST_WORKOUT: "cached_last_workout",
  WORKOUT_PLAN: "cached_workout_plan",
  NUTRITION_PREFIX: "cached_nutrition_",
  CACHE_TIMESTAMP: "cache_timestamps",
  FOOD_CACHE: "cached_foods",
};

const CACHE_EXPIRY = {
  WORKOUT_PLAN: 24 * 60 * 60 * 1000, // 24 hours
  NUTRITION_TODAY: 1 * 60 * 60 * 1000, // 1 hour (today changes frequently)
  NUTRITION_PAST: 7 * 24 * 60 * 60 * 1000, // 7 days (past dates are immutable)
  LAST_WORKOUT: 7 * 24 * 60 * 60 * 1000, // 7 days
  FOOD_CACHE: 30 * 24 * 60 * 60 * 1000, // 30 days
};

const isToday = (date: Date): boolean => {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

const getNutritionCacheExpiry = (date: Date): number =>
  isToday(date) ? CACHE_EXPIRY.NUTRITION_TODAY : CACHE_EXPIRY.NUTRITION_PAST;

// ==================== TIMESTAMPS (in-memory + AsyncStorage) ====================
type CacheTimestamps = {
  [key: string]: number;
};

let memoryTimestamps: CacheTimestamps | null = null;
let memoryTimestampsLoading: Promise<CacheTimestamps> | null = null;

const getCacheTimestamps = async (): Promise<CacheTimestamps> => {
  if (memoryTimestamps) return memoryTimestamps;

  if (memoryTimestampsLoading) return memoryTimestampsLoading;

  memoryTimestampsLoading = (async () => {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMP);
      memoryTimestamps = data ? JSON.parse(data) : {};
    } catch {
      memoryTimestamps = {};
    }
    memoryTimestampsLoading = null;
    return memoryTimestamps!;
  })();

  return memoryTimestampsLoading;
};

const persistTimestamps = async (timestamps: CacheTimestamps): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      CACHE_KEYS.CACHE_TIMESTAMP,
      JSON.stringify(timestamps)
    );
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error persisting timestamps:", error);
    }
  }
};

const setCacheTimestamp = async (key: string): Promise<void> => {
  try {
    const timestamps = await getCacheTimestamps();
    timestamps[key] = Date.now();
    memoryTimestamps = timestamps;
    await persistTimestamps(timestamps);
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error setting timestamp:", error);
    }
  }
};

const removeCacheTimestamps = async (keys: string[]): Promise<void> => {
  if (keys.length === 0) return;

  try {
    const timestamps = await getCacheTimestamps();
    let changed = false;

    for (const key of keys) {
      if (key in timestamps) {
        delete timestamps[key];
        changed = true;
      }
    }

    if (changed) {
      memoryTimestamps = timestamps;
      await persistTimestamps(timestamps);
    }
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error removing cache timestamps:", error);
    }
  }
};

const isCacheValid = async (key: string, expiryMs: number): Promise<boolean> => {
  try {
    const timestamps = await getCacheTimestamps();
    const timestamp = timestamps[key];
    if (!timestamp) return false;
    return Date.now() - timestamp < expiryMs;
  } catch {
    return false;
  }
};

// ==================== LAST WORKOUT ====================
export const cacheLastWorkout = async (
  workout: WorkoutHistory
): Promise<void> => {
  try {
    if (!workout) {
      if (__DEV__) {
        console.log(" [CacheService] Cannot cache null/undefined workout");
      }
      return;
    }
    await AsyncStorage.setItem(
      CACHE_KEYS.LAST_WORKOUT,
      JSON.stringify(workout)
    );
    await setCacheTimestamp(CACHE_KEYS.LAST_WORKOUT);
    if (__DEV__) {
      console.log(" [CacheService] Last workout cached");
    }
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error caching last workout:", error);
    }
  }
};

export const getCachedLastWorkout = async (): Promise<WorkoutHistory | null> => {
  try {
    const isValid = await isCacheValid(
      CACHE_KEYS.LAST_WORKOUT,
      CACHE_EXPIRY.LAST_WORKOUT
    );
    if (!isValid) {
      if (__DEV__) {
        console.log(" [CacheService] Last workout cache expired");
      }
      return null;
    }

    const data = await AsyncStorage.getItem(CACHE_KEYS.LAST_WORKOUT);
    if (data) {
      const workout = JSON.parse(data);
      // Convert date string back to Date object
      if (workout.date) {
        workout.date = new Date(workout.date);
      }
      return workout;
    }
    return null;
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error getting cached last workout:", error);
    }
    return null;
  }
};

// ==================== WORKOUT PLAN ====================
export const cacheWorkoutPlan = async (plan: WorkoutPlan | null): Promise<void> => {
  try {
    if (!plan) {
      // If plan is null, remove from cache
      await AsyncStorage.removeItem(CACHE_KEYS.WORKOUT_PLAN);
      if (__DEV__) {
        console.log(" [CacheService] Workout plan removed from cache");
      }
      return;
    }
    await AsyncStorage.setItem(CACHE_KEYS.WORKOUT_PLAN, JSON.stringify(plan));
    await setCacheTimestamp(CACHE_KEYS.WORKOUT_PLAN);
    if (__DEV__) {
      console.log(" [CacheService] Workout plan cached");
    }
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error caching workout plan:", error);
    }
  }
};

export const getCachedWorkoutPlan = async (): Promise<WorkoutPlan | null> => {
  try {
    const isValid = await isCacheValid(
      CACHE_KEYS.WORKOUT_PLAN,
      CACHE_EXPIRY.WORKOUT_PLAN
    );
    if (!isValid) {
      if (__DEV__) {
        console.log(" [CacheService] Workout plan cache expired");
      }
      return null;
    }

    const data = await AsyncStorage.getItem(CACHE_KEYS.WORKOUT_PLAN);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error getting cached workout plan:", error);
    }
    return null;
  }
};

// ==================== NUTRITION ====================
const getNutritionCacheKey = (date: Date): string => {
  const d = new Date(date);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
  return `${CACHE_KEYS.NUTRITION_PREFIX}${dateStr}`;
};

const toSerializableDate = (value: Date | string | undefined): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const buildNutritionCachePayload = (nutrition: DailyNutrition) => ({
  ...nutrition,
  date: toSerializableDate(nutrition.date) || nutrition.date,
  updatedAt: toSerializableDate(nutrition.updatedAt),
});

export const cacheNutritionDay = async (
  date: Date,
  nutrition: DailyNutrition
): Promise<void> => {
  try {
    //  Check if nutrition is valid
    if (!nutrition) {
      if (__DEV__) {
        console.log(" [CacheService] Cannot cache null/undefined nutrition");
      }
      return;
    }

    const key = getNutritionCacheKey(date);
    const nutritionToCache = buildNutritionCachePayload(nutrition);
    const serializedPayload = JSON.stringify(nutritionToCache);
    const existingPayload = await AsyncStorage.getItem(key);

    // Skip storage writes when nutrition payload is unchanged.
    if (existingPayload === serializedPayload) {
      return;
    }

    await AsyncStorage.setItem(key, serializedPayload);
    await setCacheTimestamp(key);
    if (__DEV__) {
      console.log(" [CacheService] Nutrition cached for:", key);
    }
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error caching nutrition:", error);
    }
  }
};

export const getCachedNutritionDay = async (
  date: Date
): Promise<DailyNutrition | null> => {
  try {
    const key = getNutritionCacheKey(date);
    const expiryMs = getNutritionCacheExpiry(date);
    const isValid = await isCacheValid(key, expiryMs);

    if (!isValid) {
      return null;
    }

    const data = await AsyncStorage.getItem(key);
    if (data) {
      const nutrition = JSON.parse(data);
      if (nutrition.date) {
        nutrition.date = new Date(nutrition.date);
      }
      return nutrition;
    }
    return null;
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error getting cached nutrition:", error);
    }
    return null;
  }
};

// ==================== CACHE FOR WEEK ====================
/**
 * Cache nutrition data for multiple days
 * @param weekData - Array of DailyNutrition objects
 */
export const cacheNutritionWeek = async (
  weekData: DailyNutrition[]
): Promise<void> => {
  try {
    if (!weekData || weekData.length === 0) {
      if (__DEV__) {
        console.log("[CacheService] No week data to cache");
      }
      return;
    }

    for (const nutrition of weekData) {
      //  Check if nutrition and date are valid
      if (nutrition && nutrition.date) {
        const date = nutrition.date instanceof Date 
          ? nutrition.date 
          : new Date(nutrition.date);
        
        await cacheNutritionDay(date, nutrition);
      }
    }
    if (__DEV__) {
      console.log(`[CacheService] Week nutrition cached (${weekData.length} days)`);
    }
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error caching week nutrition:", error);
    }
  }
};

export const getCachedNutritionForDate = async (
  date: Date
): Promise<DailyNutrition | null> => {
  return getCachedNutritionDay(date);
};

// ==================== BATCH NUTRITION READ ====================
export type BatchNutritionResult = Map<string, DailyNutrition | null>;

export const batchGetCachedNutritionDays = async (
  dates: Date[]
): Promise<BatchNutritionResult> => {
  const result: BatchNutritionResult = new Map();
  if (dates.length === 0) return result;

  try {
    const timestamps = await getCacheTimestamps();
    const now = Date.now();
    const keysToFetch: string[] = [];
    const keyToDate = new Map<string, Date>();

    for (const date of dates) {
      const key = getNutritionCacheKey(date);
      const ts = timestamps[key];
      const expiryMs = getNutritionCacheExpiry(date);

      if (!ts || now - ts >= expiryMs) {
        result.set(key, null);
        continue;
      }

      keysToFetch.push(key);
      keyToDate.set(key, date);
    }

    if (keysToFetch.length === 0) return result;

    const pairs = await AsyncStorage.multiGet(keysToFetch);

    for (const [key, raw] of pairs) {
      if (!raw) {
        result.set(key, null);
        continue;
      }

      try {
        const nutrition = JSON.parse(raw);
        if (nutrition.date) {
          nutrition.date = new Date(nutrition.date);
        }
        result.set(key, nutrition);
      } catch {
        result.set(key, null);
      }
    }

    return result;
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error batch-reading nutrition cache:", error);
    }
    return result;
  }
};

export { getNutritionCacheKey };

// ==================== FOOD CACHE (for quick search) ====================
type CachedFood = Food & {
  cachedAt: number;
};

// In-memory mirror of the food cache to avoid repeated AsyncStorage reads
let foodMemoryCache: CachedFood[] | null = null;
let foodMemoryCacheLoadingPromise: Promise<CachedFood[]> | null = null;

const loadFoodMemoryCache = async (): Promise<CachedFood[]> => {
  if (foodMemoryCache) return foodMemoryCache;
  if (foodMemoryCacheLoadingPromise) return foodMemoryCacheLoadingPromise;

  foodMemoryCacheLoadingPromise = (async () => {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEYS.FOOD_CACHE);
      foodMemoryCache = data ? JSON.parse(data) : [];
    } catch {
      foodMemoryCache = [];
    }
    foodMemoryCacheLoadingPromise = null;
    return foodMemoryCache!;
  })();

  return foodMemoryCacheLoadingPromise;
};

const persistFoodCache = async (foods: CachedFood[]): Promise<void> => {
  foodMemoryCache = foods;
  await AsyncStorage.setItem(CACHE_KEYS.FOOD_CACHE, JSON.stringify(foods));
};

export const addFoodToCache = async (food: Food): Promise<void> => {
  try {
    if (!food || !food.name) {
      return;
    }

    const foods = [...(await loadFoodMemoryCache())];
    const lowerName = food.name.toLowerCase();

    const existingIndex = foods.findIndex(
      (f) => f.name.toLowerCase() === lowerName
    );

    const cachedFood: CachedFood = {
      ...food,
      cachedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      foods[existingIndex] = cachedFood;
    } else {
      foods.unshift(cachedFood);
    }

    await persistFoodCache(foods.slice(0, 100));
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error adding food to cache:", error);
    }
  }
};

// Batch add multiple foods in a single read-modify-write cycle
export const addFoodsToCache = async (newFoods: Food[]): Promise<void> => {
  try {
    const validFoods = newFoods.filter((f) => f && f.name);
    if (validFoods.length === 0) return;

    const foods = [...(await loadFoodMemoryCache())];
    const now = Date.now();

    for (const food of validFoods) {
      const lowerName = food.name.toLowerCase();
      const existingIndex = foods.findIndex(
        (f) => f.name.toLowerCase() === lowerName
      );

      const cachedFood: CachedFood = { ...food, cachedAt: now };

      if (existingIndex >= 0) {
        foods[existingIndex] = cachedFood;
      } else {
        foods.unshift(cachedFood);
      }
    }

    await persistFoodCache(foods.slice(0, 100));
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error batch-adding foods to cache:", error);
    }
  }
};

export const getCachedFoods = async (): Promise<Food[]> => {
  try {
    const foods = await loadFoodMemoryCache();

    const validFoods = foods.filter(
      (f) => Date.now() - f.cachedAt < CACHE_EXPIRY.FOOD_CACHE
    );

    return validFoods;
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error getting cached foods:", error);
    }
    return [];
  }
};

export const searchCachedFoods = async (query: string): Promise<Food[]> => {
  try {
    const foods = await getCachedFoods();
    const lowerQuery = query.toLowerCase();

    return foods.filter((food) =>
      food.name.toLowerCase().includes(lowerQuery)
    );
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error searching cached foods:", error);
    }
    return [];
  }
};

// ==================== CLEANUP ====================
export const clearExpiredCache = async (): Promise<void> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const nutritionKeys = allKeys.filter((key) =>
      key.startsWith(CACHE_KEYS.NUTRITION_PREFIX)
    );

    let removedCount = 0;
    const removedKeys: string[] = [];
    for (const key of nutritionKeys) {
      // Use past-date TTL for cleanup (most generous)
      const isValid = await isCacheValid(key, CACHE_EXPIRY.NUTRITION_PAST);
      if (!isValid) {
        await AsyncStorage.removeItem(key);
        removedKeys.push(key);
        removedCount++;
      }
    }

    if (removedKeys.length > 0) {
      await removeCacheTimestamps(removedKeys);
    }

    if (removedCount > 0) {
      if (__DEV__) {
        console.log(`[CacheService] Removed ${removedCount} expired cache entries`);
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error clearing expired cache:", error);
    }
  }
};

export const clearNutritionCache = async (): Promise<void> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const nutritionKeys = allKeys.filter((key) =>
      key.startsWith(CACHE_KEYS.NUTRITION_PREFIX)
    );

    if (nutritionKeys.length === 0) return;

    await AsyncStorage.multiRemove(nutritionKeys);
    await removeCacheTimestamps(nutritionKeys);
    if (__DEV__) {
      console.log("[CacheService] Nutrition cache cleared");
    }
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error clearing nutrition cache:", error);
    }
  }
};

export const clearAllCache = async (): Promise<void> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(
      (key) =>
        key.startsWith("cached_") ||
        key.startsWith(CACHE_KEYS.NUTRITION_PREFIX)
    );

    await AsyncStorage.multiRemove(cacheKeys);
    await removeCacheTimestamps(cacheKeys);
    foodMemoryCache = null;
    if (__DEV__) {
      console.log("[CacheService] All cache cleared");
    }
  } catch (error) {
    if (__DEV__) {
      console.error("[CacheService] Error clearing all cache:", error);
    }
  }
};

// ==================== CACHE SIZE ====================
export const getCacheSize = async (): Promise<{
  items: number;
  sizeKB: number;
}> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(
      (key) =>
        key.startsWith("cached_") ||
        key.startsWith(CACHE_KEYS.NUTRITION_PREFIX)
    );

    let totalSize = 0;
    for (const key of cacheKeys) {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        totalSize += value.length;
      }
    }

    return {
      items: cacheKeys.length,
      sizeKB: Math.round(totalSize / 1024),
    };
  } catch {
    return { items: 0, sizeKB: 0 };
  }
};
