import { useAuth } from "@/src/contexts/authContext";
import {
    getDailyNutrition,
    saveDailyNutrition,
} from "@/src/services/nutritionService";
import { getDailyWater, saveDailyWater } from "@/src/services/waterService";
import { DailyNutrition, DailyWater, Food, WaterIntake } from "@/src/types/index";
import React, { createContext, useContext, useEffect, useState } from "react";

type NutritionContextType = {
  todayNutrition: DailyNutrition | null;
  todayWater: DailyWater | null;
  loading: boolean;
  refreshNutrition: (date?: Date) => Promise<void>;
  addFoodToMeal: (mealName: string, food: Food) => Promise<void>;
  removeFoodFromMeal: (mealName: string, foodIndex: number) => Promise<void>;
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
  const [todayNutrition, setTodayNutrition] = useState<DailyNutrition | null>(null);
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
    
    // Load nutrition
    const nutritionResult = await getDailyNutrition(user.uid, date);
    if (nutritionResult.success && nutritionResult.data) {
      setTodayNutrition(nutritionResult.data);
    } else {
      setTodayNutrition({
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
      });
    }

    // Load water
    const waterResult = await getDailyWater(user.uid, date);
    if (waterResult.success && waterResult.data) {
      setTodayWater(waterResult.data);
    } else {
      setTodayWater({
        userID: user.uid,
        date,
        goal: 2000,
        intakes: [],
        total: 0,
      });
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
    await saveDailyNutrition(updatedNutrition);
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