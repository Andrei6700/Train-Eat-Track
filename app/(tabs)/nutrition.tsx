import { colors, spacingX, spacingY } from "@/constants/theme";
import NutritionDateHeader from "@/src/components/nutrition/NutritionDateHeader";
import NutritionEditQuantityModal, {
  EditableFoodState,
} from "@/src/components/nutrition/NutritionEditQuantityModal";
import NutritionFoodActionsModal from "@/src/components/nutrition/NutritionFoodActionsModal";
import NutritionMealCard, { MealSummary } from "@/src/components/nutrition/NutritionMealCard";
import NutritionObjectiveCard, {
  NutritionStats,
} from "@/src/components/nutrition/NutritionObjectiveCard";
import NutritionWaterCard from "@/src/components/nutrition/NutritionWaterCard";
import SwipeableScreen from "@/src/components/layout/SwipeableScreen";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import NutritionCalendar from "@/src/components/ui/NutritionCalendar";
import { useAuth } from "@/src/contexts/authContext";
import { useNutrition } from "@/src/contexts/nutritionContext";
import { preloadWeekNutrition } from "@/src/services/nutritionCacheService";
import { Food } from "@/src/types/index";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, InteractionManager, RefreshControl, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MEALS = ["Mic Dejun", "Pranz", "Cina", "Gustari"] as const;
const MONTHS = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
];

type FoodWithOptionalBrand = Food & { brand?: string };
type DayData = { date: Date; calories: number; goal: number };

const DEFAULT_GOALS = {
  calorie: 2500,
  protein: 150,
  carbs: 250,
  fat: 70,
};

const CIRCUMFERENCE = 2 * Math.PI * 40;

const getWeekDays = (baseDate: Date): Date[] => {
  const today = new Date(baseDate);
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
};

const toDayLookupKey = (date: Date): string =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const normalizeDate = (date: Date | string): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const buildMealSummaries = (
  meals: { mealName: string; foods: Food[] }[] | undefined,
): MealSummary[] => {
  const mealMap = new Map<string, { mealName: string; foods: Food[] }>();
  for (const meal of meals || []) {
    mealMap.set(meal.mealName, meal);
  }

  return MEALS.map((mealName) => {
    const meal = mealMap.get(mealName);
    const foods = ((meal?.foods as FoodWithOptionalBrand[]) || []).map((food) => ({
      ...food,
    }));

    const macros = foods.reduce(
      (totals, food) => {
        totals.protein += Number(food.protein) || 0;
        totals.carbs += Number(food.carbs) || 0;
        totals.fat += Number(food.fat) || 0;
        return totals;
      },
      { protein: 0, carbs: 0, fat: 0 },
    );

    const totalGrams = macros.protein + macros.carbs + macros.fat;
    const percentages =
      totalGrams > 0
        ? {
            protein: Math.round((macros.protein / totalGrams) * 100),
            carbs: Math.round((macros.carbs / totalGrams) * 100),
            fat: Math.round((macros.fat / totalGrams) * 100),
          }
        : { protein: 0, carbs: 0, fat: 0 };

    return {
      mealName,
      foods,
      calories: foods.reduce((sum, food) => sum + (Number(food.calories) || 0), 0),
      macros,
      percentages,
      arcs: {
        protein: (percentages.protein / 100) * CIRCUMFERENCE,
        carbs: (percentages.carbs / 100) * CIRCUMFERENCE,
        fat: (percentages.fat / 100) * CIRCUMFERENCE,
      },
      hasFoods: foods.length > 0,
    };
  });
};

const Nutrition = () => {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const {
    todayNutrition,
    todayWater,
    refreshNutrition,
    addWaterIntake,
    resetWaterIntake,
    removeFoodFromMeal,
    updateFoodQuantity,
    copyFoodToMeal,
    moveFoodToMeal,
  } = useNutrition();

  const currentWeek = useMemo(() => getWeekDays(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [daysData, setDaysData] = useState<DayData[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFood, setEditingFood] = useState<EditableFoodState>(null);
  const [editQuantity, setEditQuantity] = useState("");

  const [showActionsModal, setShowActionsModal] = useState(false);
  const [actionFood, setActionFood] = useState<EditableFoodState>(null);

  const requestIdRef = useRef(0);

  const mealSummaries = useMemo(
    () => buildMealSummaries(todayNutrition?.meals),
    [todayNutrition?.meals],
  );

  const nutritionStats = useMemo<NutritionStats>(() => {
    const totalCalories = mealSummaries.reduce((sum, meal) => sum + meal.calories, 0);
    const totalMacros = mealSummaries.reduce(
      (totals, meal) => {
        totals.protein += meal.macros.protein;
        totals.carbs += meal.macros.carbs;
        totals.fat += meal.macros.fat;
        return totals;
      },
      { protein: 0, carbs: 0, fat: 0 },
    );

    const calorieGoal = todayNutrition?.calorieGoal || DEFAULT_GOALS.calorie;
    const proteinGoal = todayNutrition?.proteinGoal || DEFAULT_GOALS.protein;
    const carbsGoal = todayNutrition?.carbsGoal || DEFAULT_GOALS.carbs;
    const fatGoal = todayNutrition?.fatGoal || DEFAULT_GOALS.fat;

    return {
      totalCalories,
      totalMacros,
      remainingCalories: Math.max(calorieGoal - totalCalories, 0),
      progress: Math.min((totalCalories / calorieGoal) * 100, 100),
      calorieGoal,
      proteinGoal,
      carbsGoal,
      fatGoal,
      proteinProgress: Math.min((totalMacros.protein / proteinGoal) * 100, 100),
      carbsProgress: Math.min((totalMacros.carbs / carbsGoal) * 100, 100),
      fatProgress: Math.min((totalMacros.fat / fatGoal) * 100, 100),
    };
  }, [mealSummaries, todayNutrition]);

  const waterPercentage = useMemo(() => {
    if (!todayWater?.goal) return 0;
    return Math.min((todayWater.total / todayWater.goal) * 100, 100);
  }, [todayWater?.goal, todayWater?.total]);

  const dateHeaderLabel = useMemo(() => {
    const today = new Date();
    const normalizedSelected = normalizeDate(selectedDate);
    const normalizedToday = normalizeDate(today);
    if (normalizedSelected.toDateString() === normalizedToday.toDateString()) {
      return "Azi";
    }

    const yesterday = new Date(normalizedToday);
    yesterday.setDate(yesterday.getDate() - 1);
    if (normalizedSelected.toDateString() === yesterday.toDateString()) {
      return "Ieri";
    }

    return `${normalizedSelected.getDate()} ${MONTHS[normalizedSelected.getMonth()]}, ${normalizedSelected.getFullYear()}`;
  }, [selectedDate]);

  const loadNutritionData = useCallback(
    async (date: Date) => {
      if (!user?.uid) {
        setRefreshing(false);
        return;
      }

      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      try {
        await refreshNutrition(date);
      } finally {
        if (requestId === requestIdRef.current) {
          setRefreshing(false);
        }
      }
    },
    [refreshNutrition, user?.uid],
  );

  const preloadWeekData = useCallback(async () => {
    if (!user?.uid || currentWeek.length === 0) return;

    setCalendarLoading(true);
    try {
      const cachedData = await preloadWeekNutrition(user.uid, currentWeek);
      const daysArray: DayData[] = currentWeek.map((date) => {
        const key = toDayLookupKey(date);
        const cached = cachedData.get(key);
        return {
          date,
          calories: cached?.calories || 0,
          goal: cached?.goal || DEFAULT_GOALS.calorie,
        };
      });
      setDaysData(daysArray);
    } finally {
      setCalendarLoading(false);
    }
  }, [currentWeek, user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setDaysData([]);
      setRefreshing(false);
      return;
    }

    void loadNutritionData(selectedDate);
  }, [loadNutritionData, selectedDate, user?.uid]);

  useEffect(() => {
    if (!user?.uid || currentWeek.length === 0) return;

    const interaction = InteractionManager.runAfterInteractions(() => {
      void preloadWeekData();
    });

    return () => interaction.cancel();
  }, [currentWeek.length, preloadWeekData, user?.uid]);

  useEffect(() => {
    if (!todayNutrition || currentWeek.length === 0) return;

    const nutritionDate = normalizeDate(todayNutrition.date);
    const nutritionDateKey = toDayLookupKey(nutritionDate);
    const goal = todayNutrition.calorieGoal || DEFAULT_GOALS.calorie;
    const calories = nutritionStats.totalCalories;

    setDaysData((prevDaysData) => {
      const existingIndex = prevDaysData.findIndex(
        (day) => toDayLookupKey(day.date) === nutritionDateKey,
      );

      if (existingIndex !== -1) {
        const current = prevDaysData[existingIndex];
        if (current.calories === calories && current.goal === goal) {
          return prevDaysData;
        }

        const updated = [...prevDaysData];
        updated[existingIndex] = { ...current, calories, goal };
        return updated;
      }

      const isInCurrentWeek = currentWeek.some(
        (day) => toDayLookupKey(day) === nutritionDateKey,
      );
      if (!isInCurrentWeek) return prevDaysData;

      return [...prevDaysData, { date: nutritionDate, calories, goal }];
    });
  }, [currentWeek, nutritionStats.totalCalories, todayNutrition]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadNutritionData(selectedDate);
  }, [loadNutritionData, selectedDate]);

  const handleDayPress = useCallback((day: Date, _index?: number) => {
    setSelectedDate(day);
  }, []);

  const handleOpenSettings = useCallback(() => {
    router.push("/(modals)/nutritionSettings");
  }, [router]);

  const handleMealPress = useCallback(
    (mealName: string) => {
      router.push({
        pathname: "/(modals)/mealDetail",
        params: {
          mealName,
          date: selectedDate.toISOString(),
        },
      });
    },
    [router, selectedDate],
  );

  const handleAddWater = useCallback(
    async (amount: number) => {
      await addWaterIntake(amount);
    },
    [addWaterIntake],
  );

  const handleResetWater = useCallback(() => {
    Alert.alert(
      "Reset Water Intake",
      "Are you sure you want to reset today's water intake?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetWaterIntake();
          },
        },
      ],
    );
  }, [resetWaterIntake]);

  const handleFoodPress = useCallback(
    (mealName: string, foodIndex: number, food: FoodWithOptionalBrand) => {
      const currentQuantity = Number.parseFloat(food.servingSize) || 100;
      setEditingFood({ mealName, foodIndex, food });
      setEditQuantity(currentQuantity.toString());
      setShowEditModal(true);
    },
    [],
  );

  const handleFoodLongPress = useCallback(
    (mealName: string, foodIndex: number, food: FoodWithOptionalBrand) => {
      setActionFood({ mealName, foodIndex, food });
      setShowActionsModal(true);
    },
    [],
  );

  const handleSaveQuantity = useCallback(async () => {
    const parsedQuantity = Number.parseFloat(editQuantity);
    if (!editingFood || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      Alert.alert("Eroare", "Te rog introdu o cantitate valida");
      return;
    }

    await updateFoodQuantity(editingFood.mealName, editingFood.foodIndex, parsedQuantity);
    setShowEditModal(false);
    setEditingFood(null);
    Alert.alert("Success", "Cantitatea a fost actualizata!");
  }, [editQuantity, editingFood, updateFoodQuantity]);

  const closeEditModal = useCallback(() => {
    setShowEditModal(false);
    setEditingFood(null);
  }, []);

  const closeActionsModal = useCallback(() => {
    setShowActionsModal(false);
    setActionFood(null);
  }, []);

  const handleCopyFood = useCallback(
    async (toMeal: string) => {
      if (!actionFood) return;
      await copyFoodToMeal(actionFood.mealName, actionFood.foodIndex, toMeal);
      setShowActionsModal(false);
      Alert.alert("Success", `${actionFood.food.name} copiat la ${toMeal}`);
    },
    [actionFood, copyFoodToMeal],
  );

  const handleMoveFood = useCallback(
    async (toMeal: string) => {
      if (!actionFood) return;
      await moveFoodToMeal(actionFood.mealName, actionFood.foodIndex, toMeal);
      setShowActionsModal(false);
      Alert.alert("Success", `${actionFood.food.name} mutat la ${toMeal}`);
    },
    [actionFood, moveFoodToMeal],
  );

  const handleDeleteFood = useCallback(() => {
    if (!actionFood) return;

    Alert.alert("Sterge aliment", `Esti sigur ca vrei sa stergi ${actionFood.food.name}?`, [
      { text: "Anuleaza", style: "cancel" },
      {
        text: "Sterge",
        style: "destructive",
        onPress: async () => {
          await removeFoodFromMeal(actionFood.mealName, actionFood.foodIndex);
          setShowActionsModal(false);
          Alert.alert("Success", "Alimentul a fost sters!");
        },
      },
    ]);
  }, [actionFood, removeFoodFromMeal]);

  return (
    <SwipeableScreen>
      <ScreenWrapper>
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <NutritionDateHeader dateLabel={dateHeaderLabel} onOpenSettings={handleOpenSettings} />

          <NutritionCalendar
            currentWeek={currentWeek}
            selectedDate={selectedDate}
            daysData={daysData}
            loading={calendarLoading}
            onDayPress={handleDayPress}
          />

          <NutritionObjectiveCard stats={nutritionStats} />

          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.mealsSection}>
            {mealSummaries.map((summary) => (
              <NutritionMealCard
                key={summary.mealName}
                summary={summary}
                onMealPress={handleMealPress}
                onFoodPress={handleFoodPress}
                onFoodLongPress={handleFoodLongPress}
              />
            ))}
          </Animated.View>

          <NutritionWaterCard
            waterPercentage={waterPercentage}
            total={todayWater?.total || 0}
            goal={todayWater?.goal || 2000}
            onResetWater={handleResetWater}
            onAddWater={handleAddWater}
          />
        </ScrollView>

        <NutritionEditQuantityModal
          visible={showEditModal}
          editingFood={editingFood}
          editQuantity={editQuantity}
          bottomInset={insets.bottom}
          onClose={closeEditModal}
          onChangeQuantity={setEditQuantity}
          onSave={handleSaveQuantity}
        />

        <NutritionFoodActionsModal
          visible={showActionsModal}
          actionFood={actionFood}
          meals={[...MEALS]}
          bottomInset={insets.bottom}
          onClose={closeActionsModal}
          onCopy={handleCopyFood}
          onMove={handleMoveFood}
          onDelete={handleDeleteFood}
        />
      </ScreenWrapper>
    </SwipeableScreen>
  );
};

export default Nutrition;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  mealsSection: {
    marginBottom: spacingY._30,
    gap: spacingY._15,
  },
});
