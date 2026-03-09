import { colors, spacingX, spacingY } from "@/constants/theme";
import SwipeableScreen from "@/src/components/layout/SwipeableScreen";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import NutritionCalendarLogModal from "@/src/components/nutrition/NutritionCalendarLogModal";
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
import NutritionCalendar, {
  NutritionCalendarDayData,
} from "@/src/components/ui/NutritionCalendar";
import { useAuth } from "@/src/contexts/authContext";
import { useLanguage } from "@/src/contexts/languageContext";
import { useNutrition } from "@/src/contexts/nutritionContext";
import { getMealLabel, MONTH_NAMES } from "@/src/i18n/translations";
import { getUserNutritionHistory } from "@/src/services/nutritionService";
import { DailyNutrition, Food } from "@/src/types/index";
import { startOfDay, toValidDate } from "@/src/utils/dateKey";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, InteractionManager, RefreshControl, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MEALS = ["Mic Dejun", "Pranz", "Cina", "Gustari"] as const;

type FoodWithOptionalBrand = Food & { brand?: string };
type DayData = NutritionCalendarDayData;

const DEFAULT_GOALS = {
  calorie: 2500,
  protein: 150,
  carbs: 250,
  fat: 70,
};

const CIRCUMFERENCE = 2 * Math.PI * 40;

const toDayLookupKey = (date: Date): string =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const normalizeDate = (date: Date | string): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const buildCalendarDays = (earliestDate: Date | null): Date[] => {
  const today = startOfDay(new Date());
  const startDate = earliestDate
    ? new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1)
    : new Date(today.getFullYear(), today.getMonth(), 1);

  const days: Date[] = [];
  for (let day = new Date(startDate); day <= today; day.setDate(day.getDate() + 1)) {
    days.push(new Date(day));
  }

  return days;
};

const getCaloriesFromNutrition = (nutritionDay: DailyNutrition): number => {
  const meals = Array.isArray(nutritionDay.meals) ? nutritionDay.meals : [];
  return meals.reduce((totalCalories, meal) => {
    const mealFoods = Array.isArray(meal.foods) ? meal.foods : [];
    const mealCalories = mealFoods.reduce((sum, food) => sum + (Number(food.calories) || 0), 0);
    return totalCalories + mealCalories;
  }, 0);
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
  const { language, t } = useLanguage();
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

  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [refreshing, setRefreshing] = useState(false);
  const [daysData, setDaysData] = useState<DayData[]>([]);
  const [calendarDays, setCalendarDays] = useState<Date[]>(() => buildCalendarDays(null));
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [showCalendarLogModal, setShowCalendarLogModal] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFood, setEditingFood] = useState<EditableFoodState>(null);
  const [editQuantity, setEditQuantity] = useState("");

  const [showActionsModal, setShowActionsModal] = useState(false);
  const [actionFood, setActionFood] = useState<EditableFoodState>(null);

  const dataRequestIdRef = useRef(0);
  const calendarRequestIdRef = useRef(0);

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
    const today = startOfDay(new Date());
    const normalizedSelected = startOfDay(selectedDate);

    if (normalizedSelected.toDateString() === today.toDateString()) {
      return t("common_today");
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (normalizedSelected.toDateString() === yesterday.toDateString()) {
      return t("common_yesterday");
    }

    return `${normalizedSelected.getDate()} ${MONTH_NAMES[language][normalizedSelected.getMonth()]}, ${normalizedSelected.getFullYear()}`;
  }, [language, selectedDate, t]);

  const calendarDataSignature = useMemo(() => {
    let hash = 0;
    for (const day of daysData) {
      const key = toDayLookupKey(day.date);
      for (let index = 0; index < key.length; index += 1) {
        hash = (hash * 31 + key.charCodeAt(index)) | 0;
      }
      hash = (hash * 31 + day.calories) | 0;
      hash = (hash * 31 + day.goal) | 0;
    }
    return `${daysData.length}-${hash}`;
  }, [daysData]);

  const calendarExtraDataToken = useMemo(
    () => `${calendarDays.length}-${calendarDataSignature}`,
    [calendarDataSignature, calendarDays.length],
  );

  const mainCalendarInitialIndex = useMemo(() => {
    const todayKey = toDayLookupKey(startOfDay(new Date()));
    const todayIndex = calendarDays.findIndex((day) => toDayLookupKey(day) === todayKey);
    if (todayIndex !== -1) return todayIndex;
    return Math.max(calendarDays.length - 1, 0);
  }, [calendarDays]);

  const loadNutritionData = useCallback(
    async (date: Date) => {
      if (!user?.uid) return;

      dataRequestIdRef.current += 1;
      const requestId = dataRequestIdRef.current;

      try {
        await refreshNutrition(date);
      } catch (error) {
        console.error("[Nutrition] Error refreshing selected date:", error);
      } finally {
        if (requestId !== dataRequestIdRef.current) return;
      }
    },
    [refreshNutrition, user?.uid],
  );

  const loadCalendarHistory = useCallback(async () => {
    const userId = user?.uid;
    calendarRequestIdRef.current += 1;
    const requestId = calendarRequestIdRef.current;

    if (!userId) {
      setDaysData([]);
      setCalendarDays(buildCalendarDays(null));
      setCalendarLoading(false);
      return;
    }

    setCalendarLoading(true);

    try {
      const result = await getUserNutritionHistory(userId);
      if (requestId !== calendarRequestIdRef.current) return;

      if (!(result.success && Array.isArray(result.data))) {
        setDaysData([]);
        setCalendarDays(buildCalendarDays(null));
        return;
      }

      const nutritionHistory = result.data as DailyNutrition[];
      const dayMap = new Map<string, DayData>();
      let earliestTimestamp: number | null = null;

      for (const entry of nutritionHistory) {
        const parsedDate = toValidDate(entry.date);
        if (!parsedDate) continue;

        const normalizedDate = startOfDay(parsedDate);
        const dateTimestamp = normalizedDate.getTime();
        if (earliestTimestamp === null || dateTimestamp < earliestTimestamp) {
          earliestTimestamp = dateTimestamp;
        }

        const dayKey = toDayLookupKey(normalizedDate);
        if (dayMap.has(dayKey)) continue;

        dayMap.set(dayKey, {
          date: normalizedDate,
          calories: getCaloriesFromNutrition(entry),
          goal: entry.calorieGoal || DEFAULT_GOALS.calorie,
        });
      }

      setDaysData(Array.from(dayMap.values()));
      setCalendarDays(
        buildCalendarDays(earliestTimestamp === null ? null : new Date(earliestTimestamp)),
      );
    } catch (error) {
      console.error("[Nutrition] Error loading nutrition history:", error);
      if (requestId !== calendarRequestIdRef.current) return;

      setDaysData([]);
      setCalendarDays(buildCalendarDays(null));
    } finally {
      if (requestId === calendarRequestIdRef.current) {
        setCalendarLoading(false);
      }
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setDaysData([]);
      setCalendarDays(buildCalendarDays(null));
      setRefreshing(false);
      setShowCalendarLogModal(false);
      return;
    }

    void loadNutritionData(selectedDate);
  }, [loadNutritionData, selectedDate, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    const interaction = InteractionManager.runAfterInteractions(() => {
      void loadCalendarHistory();
    });

    return () => interaction.cancel();
  }, [loadCalendarHistory, user?.uid]);

  useEffect(() => {
    if (!todayNutrition) return;

    const nutritionDate = toValidDate(todayNutrition.date);
    if (!nutritionDate) return;

    const normalizedDate = startOfDay(nutritionDate);
    const today = startOfDay(new Date());
    if (normalizedDate > today) return;

    const nutritionDateKey = toDayLookupKey(normalizedDate);
    const calories = nutritionStats.totalCalories;
    const goal = todayNutrition.calorieGoal || DEFAULT_GOALS.calorie;

    setDaysData((previousDaysData) => {
      const existingIndex = previousDaysData.findIndex(
        (day) => toDayLookupKey(day.date) === nutritionDateKey,
      );

      if (existingIndex !== -1) {
        const existing = previousDaysData[existingIndex];
        if (existing.calories === calories && existing.goal === goal) {
          return previousDaysData;
        }

        const updated = [...previousDaysData];
        updated[existingIndex] = { ...existing, calories, goal };
        return updated;
      }

      return [...previousDaysData, { date: normalizedDate, calories, goal }];
    });
  }, [nutritionStats.totalCalories, todayNutrition]);

  useEffect(() => {
    return () => {
      dataRequestIdRef.current += 1;
      calendarRequestIdRef.current += 1;
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);

    void (async () => {
      try {
        await Promise.all([loadNutritionData(selectedDate), loadCalendarHistory()]);
      } finally {
        setRefreshing(false);
      }
    })();
  }, [loadCalendarHistory, loadNutritionData, selectedDate]);

  const handleDayPress = useCallback((day: Date, _index?: number) => {
    const today = startOfDay(new Date());
    if (day > today) return;

    setSelectedDate(normalizeDate(day));
  }, []);

  const handleOpenSettings = useCallback(() => {
    router.push("/(modals)/nutritionSettings");
  }, [router]);

  const handleOpenCalendarLog = useCallback(() => {
    setShowCalendarLogModal(true);
  }, []);

  const handleCloseCalendarLog = useCallback(() => {
    setShowCalendarLogModal(false);
  }, []);

  const handleCalendarModalDayPress = useCallback((day: Date, _index?: number) => {
    const today = startOfDay(new Date());
    if (day > today) return;

    const normalizedDate = startOfDay(day);
    setSelectedDate(normalizedDate);
  }, []);

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
      t("nutrition_reset_water_title"),
      t("nutrition_reset_water_message"),
      [
        { text: t("common_cancel"), style: "cancel" },
        {
          text: t("nutrition_reset"),
          style: "destructive",
          onPress: async () => {
            await resetWaterIntake();
          },
        },
      ],
    );
  }, [resetWaterIntake, t]);

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
      Alert.alert(t("common_error"), t("nutrition_invalid_quantity"));
      return;
    }

    await updateFoodQuantity(editingFood.mealName, editingFood.foodIndex, parsedQuantity);
    setShowEditModal(false);
    setEditingFood(null);
    Alert.alert(t("common_success"), t("nutrition_quantity_updated"));
  }, [editQuantity, editingFood, t, updateFoodQuantity]);

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
      Alert.alert(
        t("common_success"),
        t("nutrition_copied_to_meal", {
          name: actionFood.food.name,
          meal: getMealLabel(language, toMeal),
        }),
      );
    },
    [actionFood, copyFoodToMeal, language, t],
  );

  const handleMoveFood = useCallback(
    async (toMeal: string) => {
      if (!actionFood) return;
      await moveFoodToMeal(actionFood.mealName, actionFood.foodIndex, toMeal);
      setShowActionsModal(false);
      Alert.alert(
        t("common_success"),
        t("nutrition_moved_to_meal", {
          name: actionFood.food.name,
          meal: getMealLabel(language, toMeal),
        }),
      );
    },
    [actionFood, language, moveFoodToMeal, t],
  );

  const handleDeleteFood = useCallback(() => {
    if (!actionFood) return;

    Alert.alert(
      t("nutrition_delete_food_title"),
      t("nutrition_delete_food_message", {
        name: actionFood.food.name,
      }),
      [
        { text: t("common_cancel"), style: "cancel" },
        {
          text: t("nutrition_delete_food"),
          style: "destructive",
          onPress: async () => {
            await removeFoodFromMeal(actionFood.mealName, actionFood.foodIndex);
            setShowActionsModal(false);
            Alert.alert(t("common_success"), t("nutrition_food_deleted"));
          },
        },
      ],
    );
  }, [actionFood, removeFoodFromMeal, t]);

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
          <NutritionDateHeader
            dateLabel={dateHeaderLabel}
            onOpenCalendarLog={handleOpenCalendarLog}
            onOpenSettings={handleOpenSettings}
          />

          <NutritionCalendar
            calendarDays={calendarDays}
            daysData={daysData}
            loading={calendarLoading}
            initialIndex={mainCalendarInitialIndex}
            extraDataToken={calendarExtraDataToken}
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

        {showCalendarLogModal && (
          <NutritionCalendarLogModal
            visible={showCalendarLogModal}
            calendarDays={calendarDays}
            daysData={daysData}
            selectedDate={selectedDate}
            loading={calendarLoading}
            onClose={handleCloseCalendarLog}
            onDaySelect={handleCalendarModalDayPress}
          />
        )}

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
