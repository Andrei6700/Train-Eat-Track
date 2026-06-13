import { useAuth } from "@/src/contexts/authContext";
import {
  addFoodToCache,
  cacheNutritionDay,
  cacheNutritionWeek,
  clearNutritionCache,
  getCachedNutritionForDate,
} from "@/src/services/cacheService";
import {
  clearNutritionMemoryCache,
  getNutritionMemoryCache,
  markNutritionWeekPreloaded,
  setNutritionMemoryCache,
  shouldPreloadNutritionWeek,
} from "@/src/services/nutritionCacheService";
import {
  getDailyNutrition,
  getDateKey,
  saveDailyNutrition,
} from "@/src/services/nutritionService";
import { addRecentFood } from "@/src/services/recentFoodsService";
import {
  enqueueOrMergeAction,
  getSyncQueue,
  SyncAction,
  SyncActionStatus,
} from "@/src/services/syncQueueService";
import {
  getDailyWater,
  getWaterDateKey,
  saveDailyWater,
} from "@/src/services/waterService";
import { DailyNutrition, DailyWater, Food, WaterIntake } from "@/src/types/index";
import { startOfDay } from "@/src/utils/dateKey";
import NetInfo from "@react-native-community/netinfo";
import { InteractionManager } from "react-native";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type RefreshNutritionReason =
  | "screen_mount"
  | "date_switch"
  | "pull_to_refresh"
  | "user_change";

export type RefreshNutritionOptions = {
  forceRemote?: boolean;
  preloadWeek?: boolean;
  reason?: RefreshNutritionReason;
};

type NutritionContextType = {
  todayNutrition: DailyNutrition | null;
  todayWater: DailyWater | null;
  loading: boolean;
  refreshNutrition: (
    date?: Date,
    options?: RefreshNutritionOptions,
  ) => Promise<void>;
  addFoodToMeal: (mealName: string, food: Food) => Promise<void>;
  removeFoodFromMeal: (mealName: string, foodIndex: number) => Promise<void>;
  updateFoodQuantity: (
    mealName: string,
    foodIndex: number,
    newQuantity: number,
  ) => Promise<void>;
  copyFoodToMeal: (
    fromMeal: string,
    foodIndex: number,
    toMeal: string,
  ) => Promise<void>;
  moveFoodToMeal: (
    fromMeal: string,
    foodIndex: number,
    toMeal: string,
  ) => Promise<void>;
  updateGoals: (goals: {
    calorieGoal?: number;
    proteinGoal?: number;
    carbsGoal?: number;
    fatGoal?: number;
  }) => Promise<void>;
  addWaterIntake: (amount: number) => Promise<void>;
  resetWaterIntake: () => Promise<void>;
  removeWaterIntake: (intakeIndex: number) => Promise<void>;
};

const buildDefaultNutrition = (userID: string, date: Date): DailyNutrition => ({
  userID,
  date,
  calorieGoal: 2500,
  proteinGoal: 150,
  carbsGoal: 250,
  fatGoal: 70,
  meals: [
    { mealName: "Mic Dejun", foods: [] },
    { mealName: "Pranz", foods: [] },
    { mealName: "Cina", foods: [] },
    { mealName: "Gustari", foods: [] },
  ],
});

const buildDefaultWater = (userID: string, date: Date): DailyWater => ({
  userID,
  date,
  goal: 2000,
  intakes: [],
  total: 0,
});

const toMillis = (value: unknown): number | null => {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === "function") {
      const parsed = toDate();
      return parsed instanceof Date ? parsed.getTime() : null;
    }
  }
  return null;
};

const toDate = (value: unknown, fallback: Date): Date => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date(fallback) : new Date(value);
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const parsed = (value as { toDate?: () => Date }).toDate?.();
    if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date(fallback);
};

const cloneNutrition = (
  nutrition: DailyNutrition,
  userID: string,
  fallbackDate: Date,
): DailyNutrition => {
  const normalizedDate = startOfDay(toDate(nutrition.date, fallbackDate));

  return {
    ...nutrition,
    userID: nutrition.userID || userID,
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

const cloneWater = (
  water: DailyWater,
  userID: string,
  fallbackDate: Date,
): DailyWater => {
  const normalizedDate = startOfDay(toDate(water.date, fallbackDate));

  return {
    ...water,
    userID: water.userID || userID,
    date: normalizedDate,
    updatedAt: water.updatedAt
      ? toDate(water.updatedAt, normalizedDate)
      : undefined,
    intakes: Array.isArray(water.intakes)
      ? water.intakes.map((intake) => ({
          ...intake,
          timestamp: toDate(intake.timestamp, normalizedDate),
        }))
      : [],
  };
};

type WaterMemoryEntry = {
  data: DailyWater;
  signature: string;
  updatedAt: number;
};

const WATER_DAY_CACHE_TTL_MS = 30 * 1000;

const getWaterCacheKey = (userID: string, date: Date): string =>
  `${userID}:${getWaterDateKey(date)}`;

const buildWaterSignature = (water: DailyWater): string => {
  const normalizedDate = toDate(water.date, new Date());
  return JSON.stringify({
    ...water,
    date: normalizedDate.toISOString(),
    updatedAt: water.updatedAt
      ? toDate(water.updatedAt, normalizedDate).toISOString()
      : null,
    intakes: Array.isArray(water.intakes)
      ? water.intakes.map((intake) => ({
          ...intake,
          timestamp: toDate(intake.timestamp, normalizedDate).toISOString(),
        }))
      : [],
  });
};

const getWaterMemoryCache = (
  cache: Map<string, WaterMemoryEntry>,
  userID: string,
  date: Date,
  options?: { allowStale?: boolean },
): { data: DailyWater | null; isFresh: boolean } => {
  const entry = cache.get(getWaterCacheKey(userID, date));
  if (!entry) {
    return { data: null, isFresh: false };
  }

  const isFresh = Date.now() - entry.updatedAt < WATER_DAY_CACHE_TTL_MS;
  if (!isFresh && !options?.allowStale) {
    return { data: null, isFresh: false };
  }

  return {
    data: cloneWater(entry.data, userID, date),
    isFresh,
  };
};

const setWaterMemoryCache = (
  cache: Map<string, WaterMemoryEntry>,
  userID: string,
  date: Date,
  water: DailyWater,
): { written: boolean; touched: boolean } => {
  const normalized = cloneWater(water, userID, date);
  const key = getWaterCacheKey(userID, date);
  const signature = buildWaterSignature(normalized);
  const existing = cache.get(key);

  if (existing && existing.signature === signature) {
    existing.updatedAt = Date.now();
    return { written: false, touched: true };
  }

  cache.set(key, {
    data: normalized,
    signature,
    updatedAt: Date.now(),
  });

  return { written: true, touched: false };
};

const clearWaterMemoryCache = (
  cache: Map<string, WaterMemoryEntry>,
  userID?: string,
) => {
  if (!userID) {
    cache.clear();
    return;
  }

  const prefix = `${userID}:`;
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
};

const ACTIVE_SYNC_STATUSES = new Set<SyncActionStatus>([
  "pending",
  "processing",
  "retry_scheduled",
  "failed",
  "conflict",
]);

const isQueueActionActive = (action: SyncAction): boolean =>
  ACTIVE_SYNC_STATUSES.has(action.status);

const applyQueuedNutritionState = (
  nutrition: DailyNutrition,
  userID: string,
  date: Date,
  queue: SyncAction[],
): DailyNutrition => {
  const dateKey = getDateKey(date);
  const relevantActions = queue
    .filter((action) => isQueueActionActive(action))
    .filter((action) => {
      if (action.type === "UPSERT_NUTRITION") {
        const payload = action.data as { userID?: string; dateKey?: string };
        return payload.userID === userID && payload.dateKey === dateKey;
      }

      if (action.type === "UPSERT_GOALS") {
        const payload = action.data as { userID?: string; dateKey?: string };
        return payload.userID === userID && payload.dateKey === dateKey;
      }

      return false;
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  let nextNutrition = nutrition;

  for (const action of relevantActions) {
    if (action.type === "UPSERT_NUTRITION") {
      const snapshot = (action.data as { nutrition?: DailyNutrition }).nutrition;
      if (!snapshot) continue;
      nextNutrition = {
        ...nextNutrition,
        ...snapshot,
        date: toDate(snapshot.date, date),
      };
      continue;
    }

    if (action.type === "UPSERT_GOALS") {
      const goals = (action.data as {
        goals?: {
          calorieGoal?: number;
          proteinGoal?: number;
          carbsGoal?: number;
          fatGoal?: number;
        };
      }).goals;

      if (!goals) continue;
      nextNutrition = {
        ...nextNutrition,
        ...goals,
      };
    }
  }

  return nextNutrition;
};

const applyQueuedWaterState = (
  water: DailyWater,
  userID: string,
  date: Date,
  queue: SyncAction[],
): DailyWater => {
  const dateKey = getWaterDateKey(date);
  const action = [...queue]
    .filter((entry) => isQueueActionActive(entry))
    .filter((entry) => entry.type === "UPSERT_WATER")
    .filter((entry) => {
      const payload = entry.data as { userID?: string; dateKey?: string };
      return payload.userID === userID && payload.dateKey === dateKey;
    })
    .sort((left, right) => right.timestamp - left.timestamp)[0];

  if (!action) return water;
  const snapshot = (action.data as { water?: DailyWater }).water;
  if (!snapshot) return water;

  return {
    ...water,
    ...snapshot,
    date: toDate(snapshot.date, date),
    intakes: Array.isArray(snapshot.intakes)
      ? snapshot.intakes.map((intake) => ({
          ...intake,
          timestamp: toDate(intake.timestamp, date),
        }))
      : [],
  };
};

const runAfterInteractions = (task: () => Promise<void>): Promise<void> =>
  new Promise((resolve, reject) => {
    InteractionManager.runAfterInteractions(() => {
      void task().then(resolve).catch(reject);
    });
  });

type RemoteDayFetchResult = {
  nutrition: DailyNutrition | null;
  water: DailyWater | null;
  nutritionError: unknown;
  waterError: unknown;
};

const NutritionContext = createContext<NutritionContextType | null>(null);

export const NutritionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [todayNutrition, setTodayNutrition] = useState<DailyNutrition | null>(null);
  const [todayWater, setTodayWater] = useState<DailyWater | null>(null);
  const [loading, setLoading] = useState(true);

  const previousUserIdRef = useRef<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const inFlightDayRequestsRef = useRef<Map<string, Promise<RemoteDayFetchResult>>>(
    new Map(),
  );
  const inFlightWeekPreloadRef = useRef<Map<string, Promise<void>>>(new Map());
  const waterMemoryCacheRef = useRef<Map<string, WaterMemoryEntry>>(new Map());

  const cacheNutritionSnapshot = useCallback(async (nutrition: DailyNutrition) => {
    const date = startOfDay(toDate(nutrition.date, new Date()));
    const userID = nutrition.userID;
    if (!userID) return;

    const memoryWrite = setNutritionMemoryCache(userID, date, nutrition);
    if (!memoryWrite.written) {
      return;
    }

    await cacheNutritionDay(date, nutrition);
  }, []);

  const cacheWaterSnapshot = useCallback((water: DailyWater) => {
    const date = startOfDay(toDate(water.date, new Date()));
    const userID = water.userID;
    if (!userID) return;

    setWaterMemoryCache(waterMemoryCacheRef.current, userID, date, water);
  }, []);

  const resolveNutritionData = useCallback(async (userID: string, date: Date) => {
    const nutritionResult = await getDailyNutrition(userID, date);
    if (nutritionResult.success && nutritionResult.data) {
      return cloneNutrition(nutritionResult.data as DailyNutrition, userID, date);
    }

    if (!nutritionResult.success) {
      throw new Error(nutritionResult.msg || "Failed to fetch nutrition");
    }

    return buildDefaultNutrition(userID, date);
  }, []);

  const resolveWaterData = useCallback(async (userID: string, date: Date) => {
    const waterResult = await getDailyWater(userID, date);
    if (waterResult.success && waterResult.data) {
      return cloneWater(waterResult.data as DailyWater, userID, date);
    }

    if (!waterResult.success) {
      throw new Error(waterResult.msg || "Failed to fetch water");
    }

    return buildDefaultWater(userID, date);
  }, []);

  const fetchRemoteDayData = useCallback(
    async (userID: string, date: Date): Promise<RemoteDayFetchResult> => {
      const key = `${userID}:${getDateKey(date)}`;
      const existingRequest = inFlightDayRequestsRef.current.get(key);
      if (existingRequest) {
        return existingRequest;
      }

      const request = (async () => {
        const [nutritionResult, waterResult] = await Promise.allSettled([
          resolveNutritionData(userID, date),
          resolveWaterData(userID, date),
        ]);

        return {
          nutrition:
            nutritionResult.status === "fulfilled" ? nutritionResult.value : null,
          water: waterResult.status === "fulfilled" ? waterResult.value : null,
          nutritionError:
            nutritionResult.status === "rejected" ? nutritionResult.reason : null,
          waterError: waterResult.status === "rejected" ? waterResult.reason : null,
        } satisfies RemoteDayFetchResult;
      })().finally(() => {
        const current = inFlightDayRequestsRef.current.get(key);
        if (current === request) {
          inFlightDayRequestsRef.current.delete(key);
        }
      });

      inFlightDayRequestsRef.current.set(key, request);
      return request;
    },
    [resolveNutritionData, resolveWaterData],
  );

  const preloadWeekData = useCallback(
    async (anchorDate: Date, options?: { forceRemote?: boolean }) => {
      const userId = user?.uid;
      if (!userId) return;

      const forceRemote = options?.forceRemote ?? false;
      if (!shouldPreloadNutritionWeek(userId, forceRemote)) {
        return;
      }

      const existing = inFlightWeekPreloadRef.current.get(userId);
      if (existing) {
        return existing;
      }

      const preloadPromise = (async () => {
        const state = await NetInfo.fetch();
        if (!state.isConnected) {
          return;
        }

        const normalizedAnchorDate = startOfDay(anchorDate);
        const weekDates = Array.from({ length: 7 }, (_, index) => {
          const date = new Date(normalizedAnchorDate);
          date.setDate(normalizedAnchorDate.getDate() - index);
          return date;
        });

        const results = await Promise.allSettled(
          weekDates.map((date) => getDailyNutrition(userId, date)),
        );

        const weekData: DailyNutrition[] = [];
        for (let index = 0; index < results.length; index += 1) {
          const result = results[index];
          const date = weekDates[index];
          if (result.status !== "fulfilled") continue;
          if (!(result.value.success && result.value.data)) continue;

          const nutrition = cloneNutrition(
            result.value.data as DailyNutrition,
            userId,
            date,
          );

          weekData.push(nutrition);
          setNutritionMemoryCache(userId, date, nutrition);
        }

        if (weekData.length > 0) {
          await cacheNutritionWeek(weekData);
        }

        markNutritionWeekPreloaded(userId);
      })()
        .catch((error) => {
          if (__DEV__) {
            console.error("[NutritionContext] Error preloading week data:", error);
          }
        })
        .finally(() => {
          const current = inFlightWeekPreloadRef.current.get(userId);
          if (current === preloadPromise) {
            inFlightWeekPreloadRef.current.delete(userId);
          }
        });

      inFlightWeekPreloadRef.current.set(userId, preloadPromise);
      return preloadPromise;
    },
    [user?.uid],
  );

  const logRefreshMetric = useCallback(
    (reason: RefreshNutritionReason, latencyMs: number) => {
      if (!__DEV__) return;

      if (reason === "screen_mount" || reason === "user_change") {
        console.log("nutrition_initial_load_latency_ms", latencyMs);
        return;
      }

      if (reason === "date_switch") {
        console.log("nutrition_date_switch_latency_ms", latencyMs);
        return;
      }

      if (reason === "pull_to_refresh") {
        console.log("nutrition_refresh_latency_ms", latencyMs);
      }
    },
    [],
  );

  const refreshNutrition = useCallback(
    async (date: Date = new Date(), options?: RefreshNutritionOptions) => {
      const userId = user?.uid;
      const normalizedDate = startOfDay(date);
      const startedAt = Date.now();
      const requestId = ++loadRequestIdRef.current;
      const forceRemote = options?.forceRemote ?? false;
      const preloadWeek = options?.preloadWeek ?? true;
      const reason = options?.reason ?? "screen_mount";

      if (!userId) {
        setTodayNutrition(null);
        setTodayWater(null);
        setLoading(false);
        logRefreshMetric(reason, Date.now() - startedAt);
        return;
      }

      setLoading(true);

      try {
        const [cachedNutritionStorage, state, syncQueue] = await Promise.all([
          getCachedNutritionForDate(normalizedDate),
          NetInfo.fetch(),
          getSyncQueue(),
        ]);

        if (requestId !== loadRequestIdRef.current) return;

        const memoryNutrition = getNutritionMemoryCache(userId, normalizedDate, {
          allowStale: true,
        });
        const freshMemoryNutrition = getNutritionMemoryCache(userId, normalizedDate);
        const memoryWater = getWaterMemoryCache(
          waterMemoryCacheRef.current,
          userId,
          normalizedDate,
          { allowStale: true },
        );

        const freshMemoryWater = getWaterMemoryCache(
          waterMemoryCacheRef.current,
          userId,
          normalizedDate,
        );

        const storageNutrition = cachedNutritionStorage
          ? cloneNutrition(cachedNutritionStorage, userId, normalizedDate)
          : null;

        const cachedNutrition = memoryNutrition.data || storageNutrition;
        const cachedWater = memoryWater.data;

        if (cachedNutrition) {
          const withQueue = applyQueuedNutritionState(
            cachedNutrition,
            userId,
            normalizedDate,
            syncQueue,
          );
          setTodayNutrition(withQueue);
        }

        if (cachedWater) {
          const withQueue = applyQueuedWaterState(
            cachedWater,
            userId,
            normalizedDate,
            syncQueue,
          );
          setTodayWater(withQueue);
        }

        const fallbackNutrition = cachedNutrition || buildDefaultNutrition(userId, normalizedDate);
        const fallbackWater = cachedWater || buildDefaultWater(userId, normalizedDate);

        if (!cachedNutrition) {
          setTodayNutrition(
            applyQueuedNutritionState(
              fallbackNutrition,
              userId,
              normalizedDate,
              syncQueue,
            ),
          );
        }

        if (!cachedWater) {
          setTodayWater(
            applyQueuedWaterState(
              fallbackWater,
              userId,
              normalizedDate,
              syncQueue,
            ),
          );
        }

        const isConnected = Boolean(state.isConnected);
        if (!isConnected) {
          setTodayNutrition(
            applyQueuedNutritionState(
              fallbackNutrition,
              userId,
              normalizedDate,
              syncQueue,
            ),
          );
          setTodayWater(
            applyQueuedWaterState(fallbackWater, userId, normalizedDate, syncQueue),
          );
          return;
        }

        const hasCacheForDay = Boolean(cachedNutrition || cachedWater);
        const hasFreshDayCache = Boolean(
          freshMemoryNutrition.data || freshMemoryWater.data,
        );

        const runRemoteFetch = async () => {
          const remoteResult = await fetchRemoteDayData(userId, normalizedDate);
          if (requestId !== loadRequestIdRef.current) return;

          if (remoteResult.nutritionError) {
            if (__DEV__) {
              console.error(
                "[NutritionContext] Nutrition fetch failed; using cache/default fallback:",
                remoteResult.nutritionError,
              );
            }
          }
          if (remoteResult.waterError) {
            if (__DEV__) {
              console.error(
                "[NutritionContext] Water fetch failed; using cache/default fallback:",
                remoteResult.waterError,
              );
            }
          }

          const nextNutrition = remoteResult.nutrition || fallbackNutrition;
          const nextWater = remoteResult.water || fallbackWater;

          if (remoteResult.nutrition) {
            void cacheNutritionSnapshot(remoteResult.nutrition);
          }
          if (remoteResult.water) {
            cacheWaterSnapshot(remoteResult.water);
          }

          const queuedNutrition = applyQueuedNutritionState(
            nextNutrition,
            userId,
            normalizedDate,
            syncQueue,
          );
          const queuedWater = applyQueuedWaterState(
            nextWater,
            userId,
            normalizedDate,
            syncQueue,
          );

          setTodayNutrition(queuedNutrition);
          setTodayWater(queuedWater);
        };

        if (!forceRemote && hasCacheForDay && hasFreshDayCache) {
          void runRemoteFetch().catch((error) => {
            if (__DEV__) {
              console.error("[NutritionContext] Background revalidation failed:", error);
            }
          });
        } else {
          await runRemoteFetch();
        }

        if (preloadWeek) {
          const preloadTask = runAfterInteractions(async () => {
            await preloadWeekData(normalizedDate, { forceRemote });
          });

          if (forceRemote) {
            await preloadTask;
          } else {
            void preloadTask.catch((error) => {
              if (__DEV__) {
                console.error("[NutritionContext] Deferred week preload failed:", error);
              }
            });
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error("[NutritionContext] Error loading daily data:", error);
        }
        if (requestId !== loadRequestIdRef.current) return;

        setTodayNutrition((prev) => prev || buildDefaultNutrition(userId, normalizedDate));
        setTodayWater((prev) => prev || buildDefaultWater(userId, normalizedDate));
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false);
        }
        logRefreshMetric(reason, Date.now() - startedAt);
      }
    },
    [
      cacheNutritionSnapshot,
      cacheWaterSnapshot,
      fetchRemoteDayData,
      logRefreshMetric,
      preloadWeekData,
      user?.uid,
    ],
  );

  const enqueueNutritionSync = useCallback(
    async (nutrition: DailyNutrition, baseUpdatedAt: number | null) => {
      const dateKey = getDateKey(new Date(nutrition.date));
      const payload = {
        ...nutrition,
        date: new Date(nutrition.date).toISOString(),
      };

      await enqueueOrMergeAction({
        type: "UPSERT_NUTRITION",
        data: {
          nutrition: payload,
          userID: nutrition.userID,
          dateKey,
        },
        dedupeKey: `${nutrition.userID}:${dateKey}`,
        baseUpdatedAt,
        mergeStrategy: "replace_latest",
      });
    },
    [],
  );

  const enqueueWaterSync = useCallback(
    async (water: DailyWater, baseUpdatedAt: number | null) => {
      const dateKey = getWaterDateKey(new Date(water.date));
      const payload = {
        ...water,
        date: new Date(water.date).toISOString(),
        intakes: water.intakes.map((intake) => ({
          ...intake,
          timestamp: new Date(intake.timestamp).toISOString(),
        })),
      };

      await enqueueOrMergeAction({
        type: "UPSERT_WATER",
        data: {
          water: payload,
          userID: water.userID,
          dateKey,
        },
        dedupeKey: `${water.userID}:${dateKey}`,
        baseUpdatedAt,
        mergeStrategy: "replace_latest",
      });
    },
    [],
  );

  const persistNutrition = useCallback(
    async (nutrition: DailyNutrition, baseUpdatedAt: number | null) => {
      try {
        const state = await NetInfo.fetch();
        if (state.isConnected) {
          const saveResult = await saveDailyNutrition(nutrition);
          if (saveResult.success) {
            const syncedNutrition: DailyNutrition = {
              ...nutrition,
              id: saveResult.data?.id || nutrition.id,
              updatedAt: new Date(),
              localUpdatedAt: undefined,
            };

            await cacheNutritionSnapshot(syncedNutrition);

            setTodayNutrition((current) => {
              if (!current) return current;
              const currentDateKey = getDateKey(new Date(current.date));
              if (currentDateKey !== getDateKey(new Date(syncedNutrition.date))) {
                return current;
              }
              return syncedNutrition;
            });
            return;
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error("[NutritionContext] Error saving nutrition snapshot:", error);
        }
      }

      await enqueueNutritionSync(nutrition, baseUpdatedAt);
    },
    [cacheNutritionSnapshot, enqueueNutritionSync],
  );

  const persistWater = useCallback(
    async (water: DailyWater, baseUpdatedAt: number | null) => {
      try {
        const state = await NetInfo.fetch();
        if (state.isConnected) {
          const saveResult = await saveDailyWater(water);
          if (saveResult.success) {
            const syncedWater: DailyWater = {
              ...water,
              id: saveResult.data?.id || water.id,
              updatedAt: new Date(),
              localUpdatedAt: undefined,
            };

            cacheWaterSnapshot(syncedWater);

            setTodayWater((current) => {
              if (!current) return current;
              const currentDateKey = getWaterDateKey(new Date(current.date));
              if (currentDateKey !== getWaterDateKey(new Date(syncedWater.date))) {
                return current;
              }
              return syncedWater;
            });
            return;
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error("[NutritionContext] Error saving water snapshot:", error);
        }
      }

      await enqueueWaterSync(water, baseUpdatedAt);
    },
    [cacheWaterSnapshot, enqueueWaterSync],
  );

  useEffect(() => {
    const handleUserChange = async () => {
      const previousUserId = previousUserIdRef.current;
      const nextUserId = user?.uid || null;
      const isUserSwitch = Boolean(
        previousUserId && nextUserId && previousUserId !== nextUserId,
      );
      const isLogout = Boolean(previousUserId && !nextUserId);

      if (isUserSwitch && previousUserId) {
        clearNutritionMemoryCache(previousUserId);
        clearWaterMemoryCache(waterMemoryCacheRef.current, previousUserId);
        inFlightDayRequestsRef.current.clear();
        inFlightWeekPreloadRef.current.clear();
        await clearNutritionCache();
        setTodayNutrition(null);
        setTodayWater(null);
      }

      previousUserIdRef.current = nextUserId;

      if (nextUserId) {
        await refreshNutrition(new Date(), {
          forceRemote: false,
          preloadWeek: true,
          reason: "user_change",
        });
      } else {
        if (isLogout) {
          clearNutritionMemoryCache();
          clearWaterMemoryCache(waterMemoryCacheRef.current);
          inFlightDayRequestsRef.current.clear();
          inFlightWeekPreloadRef.current.clear();
          await clearNutritionCache();
        }
        setTodayNutrition(null);
        setTodayWater(null);
        setLoading(false);
      }
    };

    void handleUserChange();

    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [refreshNutrition, user?.uid]);

  const addFoodToMeal = useCallback(
    async (mealName: string, food: Food) => {
      if (!todayNutrition || !user?.uid) return;
      const baseUpdatedAt = toMillis(todayNutrition.updatedAt);

      const updatedMeals = todayNutrition.meals.map((meal) => {
        if (meal.mealName === mealName) {
          return {
            ...meal,
            foods: [...meal.foods, food],
          };
        }
        return meal;
      });

      const updatedNutrition: DailyNutrition = {
        ...todayNutrition,
        meals: updatedMeals,
        localUpdatedAt: Date.now(),
      };

      setTodayNutrition(updatedNutrition);

      await cacheNutritionSnapshot(updatedNutrition);
      await addFoodToCache(food);
      await addRecentFood(user.uid, mealName, food);
      await persistNutrition(updatedNutrition, baseUpdatedAt);
    },
    [cacheNutritionSnapshot, persistNutrition, todayNutrition, user?.uid],
  );

  const removeFoodFromMeal = useCallback(
    async (mealName: string, foodIndex: number) => {
      if (!todayNutrition || !user?.uid) return;
      const baseUpdatedAt = toMillis(todayNutrition.updatedAt);

      const updatedMeals = todayNutrition.meals.map((meal) => {
        if (meal.mealName === mealName) {
          return {
            ...meal,
            foods: meal.foods.filter((_, index) => index !== foodIndex),
          };
        }
        return meal;
      });

      const updatedNutrition: DailyNutrition = {
        ...todayNutrition,
        meals: updatedMeals,
        localUpdatedAt: Date.now(),
      };

      setTodayNutrition(updatedNutrition);
      await cacheNutritionSnapshot(updatedNutrition);
      await persistNutrition(updatedNutrition, baseUpdatedAt);
    },
    [cacheNutritionSnapshot, persistNutrition, todayNutrition, user?.uid],
  );

  const updateFoodQuantity = useCallback(
    async (mealName: string, foodIndex: number, newQuantity: number) => {
      if (!todayNutrition || !user?.uid) return;
      const baseUpdatedAt = toMillis(todayNutrition.updatedAt);

      const updatedMeals = todayNutrition.meals.map((meal) => {
        if (meal.mealName === mealName) {
          const updatedFoods = [...meal.foods];
          const food = updatedFoods[foodIndex];
          const oldQuantity = Number.parseFloat(food.servingSize) || 100;
          const ratio = newQuantity / oldQuantity;

          updatedFoods[foodIndex] = {
            ...food,
            calories: Math.round(food.calories * ratio),
            protein: Math.round(food.protein * ratio * 10) / 10,
            carbs: Math.round(food.carbs * ratio * 10) / 10,
            fat: Math.round(food.fat * ratio * 10) / 10,
            servingSize: `${newQuantity}g`,
          };

          return { ...meal, foods: updatedFoods };
        }
        return meal;
      });

      const updatedNutrition: DailyNutrition = {
        ...todayNutrition,
        meals: updatedMeals,
        localUpdatedAt: Date.now(),
      };

      setTodayNutrition(updatedNutrition);
      await cacheNutritionSnapshot(updatedNutrition);
      await persistNutrition(updatedNutrition, baseUpdatedAt);
    },
    [cacheNutritionSnapshot, persistNutrition, todayNutrition, user?.uid],
  );

  const copyFoodToMeal = useCallback(
    async (fromMeal: string, foodIndex: number, toMeal: string) => {
      if (!todayNutrition || !user?.uid) return;
      const baseUpdatedAt = toMillis(todayNutrition.updatedAt);

      const sourceMeal = todayNutrition.meals.find((meal) => meal.mealName === fromMeal);
      if (!sourceMeal || !sourceMeal.foods[foodIndex]) return;

      const foodToCopy = { ...sourceMeal.foods[foodIndex] };
      const updatedMeals = todayNutrition.meals.map((meal) => {
        if (meal.mealName === toMeal) {
          return {
            ...meal,
            foods: [...meal.foods, foodToCopy],
          };
        }
        return meal;
      });

      const updatedNutrition: DailyNutrition = {
        ...todayNutrition,
        meals: updatedMeals,
        localUpdatedAt: Date.now(),
      };

      setTodayNutrition(updatedNutrition);
      await cacheNutritionSnapshot(updatedNutrition);
      await addRecentFood(user.uid, toMeal, foodToCopy);
      await persistNutrition(updatedNutrition, baseUpdatedAt);
    },
    [cacheNutritionSnapshot, persistNutrition, todayNutrition, user?.uid],
  );

  const moveFoodToMeal = useCallback(
    async (fromMeal: string, foodIndex: number, toMeal: string) => {
      if (!todayNutrition || !user?.uid) return;
      const baseUpdatedAt = toMillis(todayNutrition.updatedAt);

      const sourceMeal = todayNutrition.meals.find((meal) => meal.mealName === fromMeal);
      if (!sourceMeal || !sourceMeal.foods[foodIndex]) return;

      const foodToMove = { ...sourceMeal.foods[foodIndex] };
      const updatedMeals = todayNutrition.meals.map((meal) => {
        if (meal.mealName === fromMeal) {
          return {
            ...meal,
            foods: meal.foods.filter((_, index) => index !== foodIndex),
          };
        }
        if (meal.mealName === toMeal) {
          return {
            ...meal,
            foods: [...meal.foods, foodToMove],
          };
        }
        return meal;
      });

      const updatedNutrition: DailyNutrition = {
        ...todayNutrition,
        meals: updatedMeals,
        localUpdatedAt: Date.now(),
      };

      setTodayNutrition(updatedNutrition);
      await cacheNutritionSnapshot(updatedNutrition);
      await addRecentFood(user.uid, toMeal, foodToMove);
      await persistNutrition(updatedNutrition, baseUpdatedAt);
    },
    [cacheNutritionSnapshot, persistNutrition, todayNutrition, user?.uid],
  );

  const updateGoals = useCallback(
    async (goals: {
      calorieGoal?: number;
      proteinGoal?: number;
      carbsGoal?: number;
      fatGoal?: number;
    }) => {
      if (!todayNutrition || !user?.uid) return;
      const baseUpdatedAt = toMillis(todayNutrition.updatedAt);

      const updatedNutrition: DailyNutrition = {
        ...todayNutrition,
        ...goals,
        localUpdatedAt: Date.now(),
      };

      setTodayNutrition(updatedNutrition);
      await cacheNutritionSnapshot(updatedNutrition);

      try {
        const state = await NetInfo.fetch();
        if (state.isConnected) {
          const saveResult = await saveDailyNutrition(updatedNutrition);
          if (saveResult.success) {
            const syncedNutrition = {
              ...updatedNutrition,
              id: saveResult.data?.id || updatedNutrition.id,
              updatedAt: new Date(),
              localUpdatedAt: undefined,
            };

            await cacheNutritionSnapshot(syncedNutrition);

            setTodayNutrition((current) => {
              if (!current) return current;
              const currentDateKey = getDateKey(new Date(current.date));
              if (currentDateKey !== getDateKey(new Date(updatedNutrition.date))) {
                return current;
              }
              return syncedNutrition;
            });
            return;
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error("[NutritionContext] Error updating goals:", error);
        }
      }

      const date = new Date(updatedNutrition.date);
      const dateKey = getDateKey(date);
      await enqueueOrMergeAction({
        type: "UPSERT_GOALS",
        data: {
          userID: user.uid,
          dateKey,
          date: date.toISOString(),
          goals,
        },
        dedupeKey: `${user.uid}:${dateKey}`,
        baseUpdatedAt,
        mergeStrategy: "replace_latest",
      });
    },
    [cacheNutritionSnapshot, todayNutrition, user?.uid],
  );

  const addWaterIntake = useCallback(
    async (amount: number) => {
      if (!todayWater || !user?.uid) return;
      const baseUpdatedAt = toMillis(todayWater.updatedAt);

      const newIntake: WaterIntake = {
        amount,
        timestamp: new Date(),
      };

      const updatedWater: DailyWater = {
        ...todayWater,
        intakes: [...todayWater.intakes, newIntake],
        total: todayWater.total + amount,
        localUpdatedAt: Date.now(),
      };

      setTodayWater(updatedWater);
      cacheWaterSnapshot(updatedWater);
      await persistWater(updatedWater, baseUpdatedAt);
    },
    [cacheWaterSnapshot, persistWater, todayWater, user?.uid],
  );

  const resetWaterIntake = useCallback(
    async () => {
      if (!todayWater || !user?.uid) return;
      const baseUpdatedAt = toMillis(todayWater.updatedAt);

      const updatedWater: DailyWater = {
        ...todayWater,
        intakes: [],
        total: 0,
        localUpdatedAt: Date.now(),
      };

      setTodayWater(updatedWater);
      cacheWaterSnapshot(updatedWater);
      await persistWater(updatedWater, baseUpdatedAt);
    },
    [cacheWaterSnapshot, persistWater, todayWater, user?.uid],
  );

  const removeWaterIntake = useCallback(
    async (intakeIndex: number) => {
      if (!todayWater || !user?.uid) return;
      const baseUpdatedAt = toMillis(todayWater.updatedAt);

      const intakeToRemove = todayWater.intakes[intakeIndex];
      if (!intakeToRemove) return;

      const updatedIntakes = todayWater.intakes.filter((_, index) => index !== intakeIndex);
      const updatedWater: DailyWater = {
        ...todayWater,
        intakes: updatedIntakes,
        total: Math.max(0, todayWater.total - intakeToRemove.amount),
        localUpdatedAt: Date.now(),
      };

      setTodayWater(updatedWater);
      cacheWaterSnapshot(updatedWater);
      await persistWater(updatedWater, baseUpdatedAt);
    },
    [cacheWaterSnapshot, persistWater, todayWater, user?.uid],
  );

  const contextValue = useMemo(
    () => ({
      todayNutrition,
      todayWater,
      loading,
      refreshNutrition,
      addFoodToMeal,
      removeFoodFromMeal,
      updateFoodQuantity,
      copyFoodToMeal,
      moveFoodToMeal,
      updateGoals,
      addWaterIntake,
      resetWaterIntake,
      removeWaterIntake,
    }),
    [
      addFoodToMeal,
      addWaterIntake,
      copyFoodToMeal,
      loading,
      moveFoodToMeal,
      refreshNutrition,
      removeFoodFromMeal,
      removeWaterIntake,
      resetWaterIntake,
      todayNutrition,
      todayWater,
      updateFoodQuantity,
      updateGoals,
    ],
  );

  return (
    <NutritionContext.Provider value={contextValue}>
      {children}
    </NutritionContext.Provider>
  );
};

export const useNutrition = () => {
  const context = useContext(NutritionContext);
  if (!context) {
    throw new Error("useNutrition must be used within NutritionProvider");
  }
  return context;
};
