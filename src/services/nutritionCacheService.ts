import { DailyNutrition } from "@/src/types/index";
import { getDateKey } from "./nutritionService";

type NutritionMemoryEntry = {
  data: DailyNutrition;
  signature: string;
  updatedAt: number;
};

type NutritionMemoryResult = {
  data: DailyNutrition | null;
  isFresh: boolean;
};

const DAY_CACHE_TTL_MS = 30 * 1000;
const WEEK_PRELOAD_COOLDOWN_MS = 120 * 1000;

const dayCache = new Map<string, NutritionMemoryEntry>();
const weekPreloadAtByUser = new Map<string, number>();

const toDate = (value: Date | string, fallback: Date): Date => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
};

const cloneNutrition = (nutrition: DailyNutrition, fallbackDate: Date): DailyNutrition => {
  const normalizedDate = toDate(nutrition.date, fallbackDate);
  return {
    ...nutrition,
    date: normalizedDate,
    updatedAt: nutrition.updatedAt
      ? toDate(nutrition.updatedAt, normalizedDate)
      : undefined,
    meals: Array.isArray(nutrition.meals)
      ? nutrition.meals.map((meal) => ({
          ...meal,
          foods: Array.isArray(meal.foods)
            ? meal.foods.map((food) => ({ ...food }))
            : [],
        }))
      : [],
  };
};

const buildSignature = (nutrition: DailyNutrition): string => {
  const normalizedDate = toDate(nutrition.date, new Date());
  return JSON.stringify({
    ...nutrition,
    date: normalizedDate.toISOString(),
    updatedAt: nutrition.updatedAt
      ? toDate(nutrition.updatedAt, normalizedDate).toISOString()
      : null,
  });
};

const getCacheKey = (userID: string, date: Date): string =>
  `${userID}:${getDateKey(date)}`;

const isFresh = (entry: NutritionMemoryEntry): boolean =>
  Date.now() - entry.updatedAt < DAY_CACHE_TTL_MS;

export const NUTRITION_MEMORY_DAY_TTL_MS = DAY_CACHE_TTL_MS;
export const NUTRITION_WEEK_PRELOAD_COOLDOWN_MS = WEEK_PRELOAD_COOLDOWN_MS;

export const getNutritionMemoryCache = (
  userID: string,
  date: Date,
  options?: { allowStale?: boolean },
): NutritionMemoryResult => {
  const cacheEntry = dayCache.get(getCacheKey(userID, date));
  if (!cacheEntry) {
    return { data: null, isFresh: false };
  }

  const fresh = isFresh(cacheEntry);
  if (!fresh && !options?.allowStale) {
    return { data: null, isFresh: false };
  }

  return {
    data: cloneNutrition(cacheEntry.data, date),
    isFresh: fresh,
  };
};

export const setNutritionMemoryCache = (
  userID: string,
  date: Date,
  nutrition: DailyNutrition,
): { written: boolean; touched: boolean } => {
  const key = getCacheKey(userID, date);
  const normalized = cloneNutrition(nutrition, date);
  const signature = buildSignature(normalized);
  const existing = dayCache.get(key);

  if (existing && existing.signature === signature) {
    existing.updatedAt = Date.now();
    return { written: false, touched: true };
  }

  dayCache.set(key, {
    data: normalized,
    signature,
    updatedAt: Date.now(),
  });
  return { written: true, touched: false };
};

export const invalidateNutritionMemoryDay = (userID: string, date: Date) => {
  dayCache.delete(getCacheKey(userID, date));
};

export const clearNutritionMemoryCache = (userID?: string) => {
  if (!userID) {
    dayCache.clear();
    weekPreloadAtByUser.clear();
    return;
  }

  const prefix = `${userID}:`;
  for (const key of [...dayCache.keys()]) {
    if (key.startsWith(prefix)) {
      dayCache.delete(key);
    }
  }

  weekPreloadAtByUser.delete(userID);
};

export const shouldPreloadNutritionWeek = (
  userID: string,
  forceRemote = false,
): boolean => {
  if (forceRemote) return true;
  const lastPreloadAt = weekPreloadAtByUser.get(userID);
  if (!lastPreloadAt) return true;
  return Date.now() - lastPreloadAt >= WEEK_PRELOAD_COOLDOWN_MS;
};

export const markNutritionWeekPreloaded = (
  userID: string,
  timestamp: number = Date.now(),
) => {
  weekPreloadAtByUser.set(userID, timestamp);
};
