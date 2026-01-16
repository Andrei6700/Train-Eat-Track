import { useAuth } from "@/src/contexts/authContext";
import {
  addFoodToCache,
  cacheNutritionWeek,
  clearAllCache,
  getCachedNutritionForDate,
} from "@/src/services/cacheService";
import {
  getDailyNutrition,
  saveDailyNutrition,
} from "@/src/services/nutritionService";
import { addRecentFood } from "@/src/services/recentFoodsService";
import { getDailyWater, saveDailyWater } from "@/src/services/waterService";
import {
  DailyNutrition,
  DailyWater,
  Food,
  WaterIntake,
} from "@/src/types/index";
import NetInfo from "@react-native-community/netinfo";
import React, { createContext, useContext, useEffect, useRef, useState } from "react"; // ✅ useRef added

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
    newQuantity: number
  ) => Promise<void>;
  copyFoodToMeal: (
    fromMeal: string,
    foodIndex: number,
    toMeal: string
  ) => Promise<void>;
  moveFoodToMeal: (
    fromMeal: string,
    foodIndex: number,
    toMeal: string
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

const NutritionContext = createContext<NutritionContextType | null>(null);

export const NutritionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [todayNutrition, setTodayNutrition] = useState<DailyNutrition | null>(
    null
  );
  const [todayWater, setTodayWater] = useState<DailyWater | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Track previous user ID to detect user changes
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const handleUserChange = async () => {
      // Check if user changed
      if (previousUserIdRef.current !== null && previousUserIdRef.current !== user?.uid) {
        console.log(" [NutritionContext] User changed - clearing cache");
        await clearAllCache();
        setTodayNutrition(null);
        setTodayWater(null);
      }
      
      // Update previous user ID
      previousUserIdRef.current = user?.uid || null;

      if (user?.uid) {
        loadTodayData();
        preloadWeekData();
      } else {
        setTodayNutrition(null);
        setTodayWater(null);
        setLoading(false);
      }
    };

    handleUserChange();
  }, [user?.uid]);

  /**
   * Preload nutrition data for the current week
   */
  const preloadWeekData = async () => {
    if (!user?.uid) return;

    try {
      const state = await NetInfo.fetch();
      if (!state.isConnected) {
        console.log(" [NutritionContext] Offline - skipping preload");
        return;
      }

      const today = new Date();
      const weekData: DailyNutrition[] = [];

      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);

        const result = await getDailyNutrition(user.uid, date);
        if (result.success && result.data) {
          weekData.push(result.data);
        }
      }

      if (weekData.length > 0) {
        await cacheNutritionWeek(weekData);
        console.log(
          ` [NutritionContext] Cached ${weekData.length} days of nutrition data`
        );
      }
    } catch (error) {
      console.error("[NutritionContext] Error preloading week data:", error);
    }
  };

  const loadTodayData = async (date: Date = new Date()) => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log("[NutritionContext] Loading nutrition for:", date);

    // Try to load from cache
    const cachedNutrition = await getCachedNutritionForDate(date);
    if (cachedNutrition) {
      console.log(" [NutritionContext] Using cached nutrition data");
      setTodayNutrition(cachedNutrition);
      setLoading(false);

      // Synchronize in background only if online
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        syncNutritionInBackground(date);
      }

      loadWaterData(date);
      return;
    }

    // Check if we are online
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      console.log(" [NutritionContext] Offline - creating default nutrition");
      const defaultNutrition: DailyNutrition = {
        userID: user.uid, 
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
      };
      setTodayNutrition(defaultNutrition);
      setLoading(false);
      loadWaterData(date);
      return;
    }

    // Load from Firebase
    const nutritionResult = await getDailyNutrition(user.uid, date);

    if (nutritionResult.success && nutritionResult.data) {
      console.log("[NutritionContext] Loaded existing nutrition data");
      setTodayNutrition(nutritionResult.data);
    } else {
      console.log(
        "[NutritionContext] No nutrition data found, creating new document"
      );

      const defaultNutrition: DailyNutrition = {
        userID: user.uid,
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
      };

      const saveResult = await saveDailyNutrition(defaultNutrition);

      if (saveResult.success && saveResult.data?.id) {
        defaultNutrition.id = saveResult.data.id;
      }

      setTodayNutrition(defaultNutrition);
    }

    await loadWaterData(date);
    setLoading(false);
  };

  /**
   * Synchronize data in background
   */
  const syncNutritionInBackground = async (date: Date) => {
    if (!user?.uid) return;

    try {
      const result = await getDailyNutrition(user.uid, date);
      if (result.success && result.data) {
        setTodayNutrition(result.data);
        console.log(" [NutritionContext] Background sync completed");
      }
    } catch (error) {
      console.error("[NutritionContext] Background sync failed:", error);
    }
  };

  const loadWaterData = async (date: Date) => {
    if (!user?.uid) return;

    try {
      const state = await NetInfo.fetch();
      if (!state.isConnected) {
        // Offline - use default data
        setTodayWater({
          userID: user.uid,
          date,
          goal: 2000,
          intakes: [],
          total: 0,
        });
        return;
      }

      const waterResult = await getDailyWater(user.uid, date);

      if (waterResult.success && waterResult.data) {
        setTodayWater(waterResult.data);
      } else {
        const defaultWater: DailyWater = {
          userID: user.uid,
          date,
          goal: 2000,
          intakes: [],
          total: 0,
        };

        const saveWaterResult = await saveDailyWater(defaultWater);

        if (saveWaterResult.success && saveWaterResult.data?.id) {
          defaultWater.id = saveWaterResult.data.id;
        }

        setTodayWater(defaultWater);
      }
    } catch (error) {
      console.error("[NutritionContext] Error loading water data:", error);
      setTodayWater({
        userID: user.uid,
        date,
        goal: 2000,
        intakes: [],
        total: 0,
      });
    }
  };

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

    // Update UI immediately
    setTodayNutrition(updatedNutrition);

    // Save to local cache
    await addFoodToCache(food);

    //  Add to recent history (works offline too)
    await addRecentFood(user.uid, mealName, food);

    // Try to save to Firebase
    try {
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        const saveResult = await saveDailyNutrition(updatedNutrition);
        if (!saveResult.success) {
          console.error(
            "[NutritionContext] Failed to save food:",
            saveResult.msg
          );
        } else {
          console.log(" Food added and saved to Firebase:", food.name);
        }
      } else {
        console.log(" [NutritionContext] Offline - food saved locally");
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
    newQuantity: number
  ) => {
    if (!todayNutrition || !user?.uid) return;

    const updatedMeals = todayNutrition.meals.map((meal) => {
      if (meal.mealName === mealName) {
        const updatedFoods = [...meal.foods];
        const food = updatedFoods[foodIndex];
        const oldQuantity = parseFloat(food.servingSize) || 100;
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
    toMeal: string
  ) => {
    if (!todayNutrition || !user?.uid) return;

    const sourceMeal = todayNutrition.meals.find(
      (m) => m.mealName === fromMeal
    );
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
    toMeal: string
  ) => {
    if (!todayNutrition || !user?.uid) return;

    const sourceMeal = todayNutrition.meals.find(
      (m) => m.mealName === fromMeal
    );
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