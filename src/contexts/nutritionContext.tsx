import { useAuth } from "@/src/contexts/authContext";
import {
  addFoodToCache,
  cacheNutritionWeek,
  clearAllCache,
  getCachedNutritionForDate,
} from "@/src/services/cacheService";
import { getDailyNutrition, saveDailyNutrition } from "@/src/services/nutritionService";
import { addRecentFood } from "@/src/services/recentFoodsService";
import { getDailyWater, saveDailyWater } from "@/src/services/waterService";
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
      const [cachedNutrition, state] = await Promise.all([
        getCachedNutritionForDate(date),
        NetInfo.fetch(),
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

      setTodayNutrition(nextNutrition);
      setTodayWater(nextWater);
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
    };

    setTodayNutrition(updatedNutrition);

    await addFoodToCache(food);
    await addRecentFood(user.uid, mealName, food);

    try {
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        const saveResult = await saveDailyNutrition(updatedNutrition);
        if (!saveResult.success) {
          console.error("[NutritionContext] Failed to save food:", saveResult.msg);
        }
      }
    } catch (error) {
      console.error("[NutritionContext] Error saving food:", error);
    }
  };

  const removeFoodFromMeal = async (mealName: string, foodIndex: number) => {
    if (!todayNutrition || !user?.uid) return;

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
    };

    setTodayNutrition(updatedNutrition);

    try {
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        await saveDailyNutrition(updatedNutrition);
      }
    } catch (error) {
      console.error("[NutritionContext] Error removing food:", error);
    }
  };

  const updateFoodQuantity = async (
    mealName: string,
    foodIndex: number,
    newQuantity: number,
  ) => {
    if (!todayNutrition || !user?.uid) return;

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
    };

    setTodayNutrition(updatedNutrition);

    try {
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        await saveDailyNutrition(updatedNutrition);
      }
    } catch (error) {
      console.error("[NutritionContext] Error updating quantity:", error);
    }
  };

  const copyFoodToMeal = async (
    fromMeal: string,
    foodIndex: number,
    toMeal: string,
  ) => {
    if (!todayNutrition || !user?.uid) return;

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
    };

    setTodayNutrition(updatedNutrition);

    try {
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        await saveDailyNutrition(updatedNutrition);
        await addRecentFood(user.uid, toMeal, foodToCopy);
      }
    } catch (error) {
      console.error("[NutritionContext] Error copying food:", error);
    }
  };

  const moveFoodToMeal = async (
    fromMeal: string,
    foodIndex: number,
    toMeal: string,
  ) => {
    if (!todayNutrition || !user?.uid) return;

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
    };

    setTodayNutrition(updatedNutrition);

    try {
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        await saveDailyNutrition(updatedNutrition);
        await addRecentFood(user.uid, toMeal, foodToMove);
      }
    } catch (error) {
      console.error("[NutritionContext] Error moving food:", error);
    }
  };

  const updateGoals = async (goals: {
    calorieGoal?: number;
    proteinGoal?: number;
    carbsGoal?: number;
    fatGoal?: number;
  }) => {
    if (!todayNutrition) return;

    const updatedNutrition: DailyNutrition = {
      ...todayNutrition,
      ...goals,
    };

    setTodayNutrition(updatedNutrition);

    try {
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        await saveDailyNutrition(updatedNutrition);
      }
    } catch (error) {
      console.error("[NutritionContext] Error updating goals:", error);
    }
  };

  const addWaterIntake = async (amount: number) => {
    if (!todayWater || !user?.uid) return;

    const newIntake: WaterIntake = {
      amount,
      timestamp: new Date(),
    };

    const updatedWater: DailyWater = {
      ...todayWater,
      intakes: [...todayWater.intakes, newIntake],
      total: todayWater.total + amount,
    };

    setTodayWater(updatedWater);

    try {
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        await saveDailyWater(updatedWater);
      }
    } catch (error) {
      console.error("[NutritionContext] Error adding water:", error);
    }
  };

  const resetWaterIntake = async () => {
    if (!todayWater || !user?.uid) return;

    const updatedWater: DailyWater = {
      ...todayWater,
      intakes: [],
      total: 0,
    };

    setTodayWater(updatedWater);

    try {
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        await saveDailyWater(updatedWater);
      }
    } catch (error) {
      console.error("[NutritionContext] Error resetting water:", error);
    }
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
