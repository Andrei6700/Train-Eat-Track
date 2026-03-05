import { getDailyNutrition } from "./nutritionService";

type CachedNutrition = {
  calories: number;
  goal: number;
  date: Date;
  updatedAt: number;
};

type PublicCachedNutrition = {
  calories: number;
  goal: number;
  date: Date;
};

const STALE_AFTER_MS = 5 * 60 * 1000;
const cache = new Map<string, CachedNutrition>();

const getDayLookupKey = (date: Date): string =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const getCacheKey = (userID: string, date: Date): string =>
  `${userID}:${getDayLookupKey(date)}`;

const toPublicEntry = (entry: CachedNutrition): PublicCachedNutrition => ({
  calories: entry.calories,
  goal: entry.goal,
  date: new Date(entry.date),
});

const isFresh = (entry: CachedNutrition): boolean =>
  Date.now() - entry.updatedAt < STALE_AFTER_MS;

const buildDefaultEntry = (date: Date): CachedNutrition => ({
  calories: 0,
  goal: 2500,
  date,
  updatedAt: Date.now(),
});

const fetchAndCacheDay = async (
  userID: string,
  date: Date,
): Promise<CachedNutrition> => {
  const result = await getDailyNutrition(userID, date);
  if (!(result.success && result.data)) {
    const fallback = buildDefaultEntry(date);
    cache.set(getCacheKey(userID, date), fallback);
    return fallback;
  }

  const goal = result.data.calorieGoal || 2500;
  const meals = Array.isArray(result.data.meals)
    ? (result.data.meals as { foods: { calories?: number }[] }[])
    : [];
  const calories = meals.reduce((total: number, meal) => {
    return (
      total +
      meal.foods.reduce((sum: number, food) => sum + (Number(food.calories) || 0), 0)
    );
  }, 0);

  const nextEntry: CachedNutrition = {
    calories,
    goal,
    date,
    updatedAt: Date.now(),
  };
  cache.set(getCacheKey(userID, date), nextEntry);
  return nextEntry;
};

export const preloadWeekNutrition = async (
  userID: string,
  weekDates: Date[],
): Promise<Map<string, PublicCachedNutrition>> => {
  const responseMap = new Map<string, PublicCachedNutrition>();
  const requiredFetches: Promise<void>[] = [];
  const backgroundRevalidations: Promise<unknown>[] = [];

  for (const date of weekDates) {
    const dayKey = getDayLookupKey(date);
    const cacheKey = getCacheKey(userID, date);
    const cached = cache.get(cacheKey);

    if (cached) {
      responseMap.set(dayKey, toPublicEntry(cached));

      if (!isFresh(cached)) {
        backgroundRevalidations.push(
          fetchAndCacheDay(userID, date).catch(() => undefined),
        );
      }
      continue;
    }

    requiredFetches.push(
      fetchAndCacheDay(userID, date)
        .then((entry) => {
          responseMap.set(dayKey, toPublicEntry(entry));
        })
        .catch(() => {
          responseMap.set(dayKey, toPublicEntry(buildDefaultEntry(date)));
        }),
    );
  }

  if (requiredFetches.length > 0) {
    await Promise.allSettled(requiredFetches);
  }

  if (backgroundRevalidations.length > 0) {
    void Promise.allSettled(backgroundRevalidations);
  }

  return responseMap;
};

export const getCachedNutrition = (date: Date): PublicCachedNutrition | null => {
  const dayKey = getDayLookupKey(date);
  let latestMatch: CachedNutrition | null = null;

  for (const [key, entry] of cache.entries()) {
    if (!key.endsWith(`:${dayKey}`)) continue;
    if (!latestMatch || entry.updatedAt > latestMatch.updatedAt) {
      latestMatch = entry;
    }
  }

  return latestMatch ? toPublicEntry(latestMatch) : null;
};

export const clearCache = () => {
  cache.clear();
};

export const invalidateDayCache = (date: Date) => {
  const dayKey = getDayLookupKey(date);
  for (const key of cache.keys()) {
    if (key.endsWith(`:${dayKey}`)) {
      cache.delete(key);
    }
  }
};
