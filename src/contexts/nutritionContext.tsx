import { useAuth } from "@/src/contexts/authContext";
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
import React, { createContext, useContext, useEffect, useState } from "react";

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

  useEffect(() => {
    if (user?.uid) {
      loadTodayData();
    } else {
      setTodayNutrition(null);
      setTodayWater(null);
      setLoading(false);
    }
  }, [user?.uid]);

  const loadTodayData = async (date: Date = new Date()) => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);

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

    setLoading(false);
  };

  const refreshNutrition = async (date: Date = new Date()) => {
    await loadTodayData(date);
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

    // ✅ SALVARE ÎN FIREBASE
    const saveResult = await saveDailyNutrition(updatedNutrition);

    if (!saveResult.success) {
      console.error("[NutritionContext] Failed to save food:", saveResult.msg);
    } else {
      console.log("✅ Food added and saved to Firebase:", food.name);

      // ✅ ADAUGĂ ALIMENTUL ÎN ISTORICUL RECENT
      await addRecentFood(user.uid, mealName, food);
    }
  };

  const removeFoodFromMeal = async (mealName: string, foodIndex: number) => {
    if (!todayNutrition) return;

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
    await saveDailyNutrition(updatedNutrition);
  };

  const updateFoodQuantity = async (
    mealName: string,
    foodIndex: number,
    newQuantity: number
  ) => {
    if (!todayNutrition) return;

    const updatedMeals = todayNutrition.meals.map((meal) => {
      if (meal.mealName === mealName) {
        const updatedFoods = meal.foods.map((food, index) => {
          if (index === foodIndex) {
            const originalQuantity = parseFloat(food.servingSize) || 100;
            const multiplier = newQuantity / originalQuantity;

            return {
              ...food,
              calories: Math.round(food.calories * multiplier),
              protein: Math.round(food.protein * multiplier * 10) / 10,
              carbs: Math.round(food.carbs * multiplier * 10) / 10,
              fat: Math.round(food.fat * multiplier * 10) / 10,
              servingSize: `${newQuantity}g`,
            };
          }
          return food;
        });

        return {
          ...meal,
          foods: updatedFoods,
        };
      }
      return meal;
    });

    const updatedNutrition: DailyNutrition = {
      ...todayNutrition,
      meals: updatedMeals,
    };

    setTodayNutrition(updatedNutrition);
    await saveDailyNutrition(updatedNutrition);
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
    await saveDailyNutrition(updatedNutrition);

    // ✅ ADAUGĂ ALIMENTUL ÎN ISTORICUL RECENT AL MESEI DE DESTINAȚIE
    await addRecentFood(user.uid, toMeal, foodToCopy);
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
    await saveDailyNutrition(updatedNutrition);

    // ✅ ADAUGĂ ALIMENTUL ÎN ISTORICUL RECENT AL MESEI DE DESTINAȚIE
    await addRecentFood(user.uid, toMeal, foodToMove);
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
    await saveDailyNutrition(updatedNutrition);
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
    await saveDailyWater(updatedWater);
  };

  const resetWaterIntake = async () => {
    if (!todayWater || !user?.uid) return;

    const updatedWater: DailyWater = {
      ...todayWater,
      intakes: [],
      total: 0,
    };

    setTodayWater(updatedWater);
    await saveDailyWater(updatedWater);
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

export const useNutrition = (): NutritionContextType => {
  const context = useContext(NutritionContext);
  if (!context) {
    throw new Error("useNutrition must be used within a NutritionProvider");
  }
  return context;
};
