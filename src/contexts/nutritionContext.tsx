import { useAuth } from "@/src/contexts/authContext";
import {
  addFoodToCache,
  cacheNutritionWeek,
  clearAllCache,
  getCachedNutritionForDate,
} from "@/src/services/cacheService";
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
import NetInfo from "@react-native-community/netinfo";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type NutritionContextType = {
  todayNutrition: DailyNutrition | null;
  todayWater: DailyWater | null;
  loading: boolean;
  refreshNutrition: (date?: Date) => Promise<void>;
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
        const payload = (action.data as { userID?: string; dateKey?: string }).userID;
        const payloadKey = (action.data as { dateKey?: string }).dateKey;
        return payload === userID && payloadKey === dateKey;
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
        date: new Date(snapshot.date),
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
    date: new Date(snapshot.date),
    intakes: Array.isArray(snapshot.intakes)
      ? snapshot.intakes.map((intake) => ({
          ...intake,
          timestamp: new Date(intake.timestamp),
        }))
      : [],
  };
};

const resolveNutritionData = async (
  userID: string,
  date: Date,
  isConnected: boolean,
): Promise<DailyNutrition> => {
  if (!isConnected) {
    return buildDefaultNutrition(userID, date);
  }

  const nutritionResult = await getDailyNutrition(userID, date);
  if (nutritionResult.success && nutritionResult.data) {
    return nutritionResult.data as DailyNutrition;
  }

  const defaultNutrition = buildDefaultNutrition(userID, date);
  const saveResult = await saveDailyNutrition(defaultNutrition);
  if (saveResult.success && saveResult.data?.id) {
    defaultNutrition.id = saveResult.data.id;
  }
  return defaultNutrition;
};

const resolveWaterData = async (
  userID: string,
  date: Date,
  isConnected: boolean,
): Promise<DailyWater> => {
  if (!isConnected) {
    return buildDefaultWater(userID, date);
  }

  const waterResult = await getDailyWater(userID, date);
  if (waterResult.success && waterResult.data) {
    return waterResult.data as DailyWater;
  }

  const defaultWater = buildDefaultWater(userID, date);
  const saveResult = await saveDailyWater(defaultWater);
  if (saveResult.success && saveResult.data?.id) {
    defaultWater.id = saveResult.data.id;
  }
  return defaultWater;
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

  const preloadWeekData = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const state = await NetInfo.fetch();
      if (!state.isConnected) return;

      const today = new Date();
      const weekDates = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - index);
        return date;
      });

      const results = await Promise.allSettled(
        weekDates.map((date) => getDailyNutrition(user.uid as string, date)),
      );

      const weekData: DailyNutrition[] = [];
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        if (result.value.success && result.value.data) {
          weekData.push(result.value.data as DailyNutrition);
        }
      }

      if (weekData.length > 0) {
        await cacheNutritionWeek(weekData);
      }
    } catch (error) {
      console.error("[NutritionContext] Error preloading week data:", error);
    }
  }, [user?.uid]);

  const loadTodayData = useCallback(async (date: Date = new Date()) => {
    const userId = user?.uid;
    const requestId = ++loadRequestIdRef.current;

    if (!userId) {
      setTodayNutrition(null);
      setTodayWater(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [cachedNutrition, state, syncQueue] = await Promise.all([
        getCachedNutritionForDate(date),
        NetInfo.fetch(),
        getSyncQueue(),
      ]);
      const isConnected = Boolean(state.isConnected);

      if (requestId !== loadRequestIdRef.current) return;

      if (cachedNutrition) {
        setTodayNutrition(cachedNutrition);
      }

      const [nutritionResult, waterResult] = await Promise.allSettled([
        resolveNutritionData(userId, date, isConnected),
        resolveWaterData(userId, date, isConnected),
      ]);

      if (requestId !== loadRequestIdRef.current) return;

      const nextNutrition =
        nutritionResult.status === "fulfilled"
          ? nutritionResult.value
          : cachedNutrition || buildDefaultNutrition(userId, date);
      const nextWater =
        waterResult.status === "fulfilled"
          ? waterResult.value
          : buildDefaultWater(userId, date);

      const nutritionWithQueue = applyQueuedNutritionState(
        nextNutrition,
        userId,
        date,
        syncQueue,
      );
      const waterWithQueue = applyQueuedWaterState(
        nextWater,
        userId,
        date,
        syncQueue,
      );

      setTodayNutrition(nutritionWithQueue);
      setTodayWater(waterWithQueue);
    } catch (error) {
      console.error("[NutritionContext] Error loading daily data:", error);
      if (requestId !== loadRequestIdRef.current) return;

      setTodayNutrition((prev) => prev || buildDefaultNutrition(userId, date));
      setTodayWater((prev) => prev || buildDefaultWater(userId, date));
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [user?.uid]);

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
        console.error("[NutritionContext] Error saving nutrition snapshot:", error);
      }

      await enqueueNutritionSync(nutrition, baseUpdatedAt);
    },
    [enqueueNutritionSync],
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
        console.error("[NutritionContext] Error saving water snapshot:", error);
      }

      await enqueueWaterSync(water, baseUpdatedAt);
    },
    [enqueueWaterSync],
  );

  useEffect(() => {
    const handleUserChange = async () => {
      if (previousUserIdRef.current !== null && previousUserIdRef.current !== user?.uid) {
        await clearAllCache();
        setTodayNutrition(null);
        setTodayWater(null);
      }

      previousUserIdRef.current = user?.uid || null;

      if (user?.uid) {
        await Promise.allSettled([loadTodayData(), preloadWeekData()]);
      } else {
        setTodayNutrition(null);
        setTodayWater(null);
        setLoading(false);
      }
    };

    void handleUserChange();

    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [loadTodayData, preloadWeekData, user?.uid]);

  const refreshNutrition = async (date: Date = new Date()) => {
    await loadTodayData(date);
    await preloadWeekData();
  };

  const addFoodToMeal = async (mealName: string, food: Food) => {
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

    await addFoodToCache(food);
    await addRecentFood(user.uid, mealName, food);
    await persistNutrition(updatedNutrition, baseUpdatedAt);
  };

  const removeFoodFromMeal = async (mealName: string, foodIndex: number) => {
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
    await persistNutrition(updatedNutrition, baseUpdatedAt);
  };

  const updateFoodQuantity = async (
    mealName: string,
    foodIndex: number,
    newQuantity: number,
  ) => {
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
    await persistNutrition(updatedNutrition, baseUpdatedAt);
  };

  const copyFoodToMeal = async (
    fromMeal: string,
    foodIndex: number,
    toMeal: string,
  ) => {
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
    await addRecentFood(user.uid, toMeal, foodToCopy);
    await persistNutrition(updatedNutrition, baseUpdatedAt);
  };

  const moveFoodToMeal = async (
    fromMeal: string,
    foodIndex: number,
    toMeal: string,
  ) => {
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
    await addRecentFood(user.uid, toMeal, foodToMove);
    await persistNutrition(updatedNutrition, baseUpdatedAt);
  };

  const updateGoals = async (goals: {
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

    try {
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        const saveResult = await saveDailyNutrition(updatedNutrition);
        if (saveResult.success) {
          setTodayNutrition((current) => {
            if (!current) return current;
            const currentDateKey = getDateKey(new Date(current.date));
            if (currentDateKey !== getDateKey(new Date(updatedNutrition.date))) {
              return current;
            }
            return {
              ...updatedNutrition,
              id: saveResult.data?.id || updatedNutrition.id,
              updatedAt: new Date(),
              localUpdatedAt: undefined,
            };
          });
          return;
        }
      }
    } catch (error) {
      console.error("[NutritionContext] Error updating goals:", error);
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
  };

  const addWaterIntake = async (amount: number) => {
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
    await persistWater(updatedWater, baseUpdatedAt);
  };

  const resetWaterIntake = async () => {
    if (!todayWater || !user?.uid) return;
    const baseUpdatedAt = toMillis(todayWater.updatedAt);

    const updatedWater: DailyWater = {
      ...todayWater,
      intakes: [],
      total: 0,
      localUpdatedAt: Date.now(),
    };

    setTodayWater(updatedWater);
    await persistWater(updatedWater, baseUpdatedAt);
  };

  return (
    <NutritionContext.Provider
      value={{
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
      }}
    >
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
