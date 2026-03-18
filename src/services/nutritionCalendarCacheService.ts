import AsyncStorage from "@react-native-async-storage/async-storage";
import { DailyNutrition } from "@/src/types/index";
import { toValidDate } from "@/src/utils/dateKey";

const NUTRITION_CALENDAR_CACHE_PREFIX = "cached_nutrition_calendar_v1_";
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CALORIE_GOAL = 2500;

export type NutritionCalendarSummaryDay = {
  date: string;
  calories: number;
  goal: number;
};

export type NutritionCalendarSummary = {
  userID: string;
  earliestDate: string | null;
  days: NutritionCalendarSummaryDay[];
  updatedAt: number;
};

export type CachedNutritionCalendarSummaryResult = {
  data: NutritionCalendarSummary | null;
  isFresh: boolean;
  updatedAt: number | null;
  ageMs: number | null;
};

const getCacheKey = (userID: string): string =>
  `${NUTRITION_CALENDAR_CACHE_PREFIX}${userID}`;

const toDate = (value: Date | string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
};

const toIsoDay = (value: Date | string): string => {
  const date = toDate(value);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

const sortDaysAsc = (days: NutritionCalendarSummaryDay[]): NutritionCalendarSummaryDay[] =>
  [...days].sort(
    (left, right) => toDate(left.date).getTime() - toDate(right.date).getTime(),
  );

const dayKey = (value: Date | string): string => {
  const date = toDate(value);
  date.setHours(0, 0, 0, 0);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const sumCalories = (nutritionDay: DailyNutrition): number => {
  const meals = Array.isArray(nutritionDay.meals) ? nutritionDay.meals : [];
  return meals.reduce((totalCalories, meal) => {
    const foods = Array.isArray(meal.foods) ? meal.foods : [];
    return (
      totalCalories +
      foods.reduce((sum, food) => sum + (Number(food.calories) || 0), 0)
    );
  }, 0);
};

const readPayload = async (userID: string): Promise<NutritionCalendarSummary | null> => {
  try {
    const raw = await AsyncStorage.getItem(getCacheKey(userID));
    if (!raw) return null;

    const payload = JSON.parse(raw) as NutritionCalendarSummary;
    if (!payload || payload.userID !== userID || !Array.isArray(payload.days)) {
      return null;
    }

    return {
      ...payload,
      days: sortDaysAsc(
        payload.days.map((day) => ({
          ...day,
          date: toIsoDay(day.date),
          calories: Number(day.calories) || 0,
          goal: Number(day.goal) || DEFAULT_CALORIE_GOAL,
        })),
      ),
      earliestDate: payload.earliestDate ? toIsoDay(payload.earliestDate) : null,
      updatedAt:
        typeof payload.updatedAt === "number" && Number.isFinite(payload.updatedAt)
          ? payload.updatedAt
          : 0,
    };
  } catch (error) {
    console.error("[NutritionCalendarCache] Error reading cache:", error);
    return null;
  }
};

const writePayload = async (
  userID: string,
  summary: Omit<NutritionCalendarSummary, "updatedAt">,
): Promise<NutritionCalendarSummary> => {
  const sortedDays = sortDaysAsc(summary.days).map((day) => ({
    ...day,
    date: toIsoDay(day.date),
    calories: Number(day.calories) || 0,
    goal: Number(day.goal) || DEFAULT_CALORIE_GOAL,
  }));

  const derivedEarliest = sortedDays.length > 0 ? sortedDays[0].date : null;
  const providedEarliest = summary.earliestDate ? toIsoDay(summary.earliestDate) : null;

  let earliestDate = providedEarliest ?? derivedEarliest ?? null;
  if (providedEarliest && derivedEarliest) {
    earliestDate =
      toDate(providedEarliest).getTime() <= toDate(derivedEarliest).getTime()
        ? providedEarliest
        : derivedEarliest;
  }

  const payload: NutritionCalendarSummary = {
    userID,
    days: sortedDays,
    earliestDate,
    updatedAt: Date.now(),
  };

  await AsyncStorage.setItem(getCacheKey(userID), JSON.stringify(payload));
  return payload;
};

export const buildNutritionCalendarSummaryFromHistory = (
  userID: string,
  history: DailyNutrition[],
): NutritionCalendarSummary => {
  const map = new Map<string, NutritionCalendarSummaryDay>();
  let earliestTimestamp: number | null = null;

  for (const entry of history) {
    const parsedDate = toValidDate(entry.date);
    if (!parsedDate) continue;

    parsedDate.setHours(0, 0, 0, 0);
    const dateKey = dayKey(parsedDate);
    if (map.has(dateKey)) continue;

    const timestamp = parsedDate.getTime();
    if (earliestTimestamp === null || timestamp < earliestTimestamp) {
      earliestTimestamp = timestamp;
    }

    map.set(dateKey, {
      date: parsedDate.toISOString(),
      calories: sumCalories(entry),
      goal: entry.calorieGoal || DEFAULT_CALORIE_GOAL,
    });
  }

  const days = sortDaysAsc([...map.values()]);
  return {
    userID,
    days,
    earliestDate: earliestTimestamp === null ? null : new Date(earliestTimestamp).toISOString(),
    updatedAt: Date.now(),
  };
};

export const getCachedNutritionCalendarSummary = async (
  userID: string,
  options?: { allowStale?: boolean; ttlMs?: number },
): Promise<CachedNutritionCalendarSummaryResult> => {
  const payload = await readPayload(userID);
  if (!payload) {
    return {
      data: null,
      isFresh: false,
      updatedAt: null,
      ageMs: null,
    };
  }

  const ttlMs = options?.ttlMs ?? DEFAULT_CACHE_TTL_MS;
  const ageMs = Date.now() - payload.updatedAt;
  const isFresh = ageMs < ttlMs;

  if (!isFresh && !options?.allowStale) {
    return {
      data: null,
      isFresh: false,
      updatedAt: payload.updatedAt,
      ageMs,
    };
  }

  return {
    data: payload,
    isFresh,
    updatedAt: payload.updatedAt,
    ageMs,
  };
};

export const setCachedNutritionCalendarSummary = async (
  userID: string,
  summary: {
    earliestDate: string | null;
    days: NutritionCalendarSummaryDay[];
  },
): Promise<NutritionCalendarSummary | null> => {
  try {
    return await writePayload(userID, {
      userID,
      earliestDate: summary.earliestDate,
      days: summary.days,
    });
  } catch (error) {
    console.error("[NutritionCalendarCache] Error writing cache:", error);
    return null;
  }
};

export const upsertNutritionCalendarSummaryDay = async (
  userID: string,
  day: {
    date: Date | string;
    calories: number;
    goal: number;
  },
): Promise<NutritionCalendarSummary | null> => {
  try {
    const existing = await getCachedNutritionCalendarSummary(userID, {
      allowStale: true,
    });
    const existingDays = existing.data?.days || [];

    const nextDay: NutritionCalendarSummaryDay = {
      date: toIsoDay(day.date),
      calories: Number(day.calories) || 0,
      goal: Number(day.goal) || DEFAULT_CALORIE_GOAL,
    };

    const nextKey = dayKey(nextDay.date);
    const existingIndex = existingDays.findIndex(
      (item) => dayKey(item.date) === nextKey,
    );

    const updatedDays = [...existingDays];
    if (existingIndex === -1) {
      updatedDays.push(nextDay);
    } else {
      updatedDays[existingIndex] = nextDay;
    }

    return await writePayload(userID, {
      userID,
      earliestDate: existing.data?.earliestDate ?? null,
      days: updatedDays,
    });
  } catch (error) {
    console.error("[NutritionCalendarCache] Error upserting day:", error);
    return null;
  }
};

export const clearNutritionCalendarSummaryCache = async (
  userID?: string,
): Promise<void> => {
  try {
    if (userID) {
      await AsyncStorage.removeItem(getCacheKey(userID));
      return;
    }

    const allKeys = await AsyncStorage.getAllKeys();
    const keys = allKeys.filter((key) =>
      key.startsWith(NUTRITION_CALENDAR_CACHE_PREFIX),
    );
    if (keys.length > 0) {
      await AsyncStorage.multiRemove(keys);
    }
  } catch (error) {
    console.error("[NutritionCalendarCache] Error clearing cache:", error);
  }
};
