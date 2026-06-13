import { colors, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import SwipeableScreen from "@/src/components/layout/SwipeableScreen";
import NutritionCalendarLogModal from "@/src/components/nutrition/NutritionCalendarLogModal";
import NutritionDateHeader from "@/src/components/nutrition/NutritionDateHeader";
import NutritionEditQuantityModal, {
  EditableFoodState,
} from "@/src/components/nutrition/NutritionEditQuantityModal";
import NutritionFoodActionsModal from "@/src/components/nutrition/NutritionFoodActionsModal";
import NutritionMealCard, {
  MealSummary,
} from "@/src/components/nutrition/NutritionMealCard";
import NutritionObjectiveCard, {
  NutritionStats,
} from "@/src/components/nutrition/NutritionObjectiveCard";
import NutritionWaterCard from "@/src/components/nutrition/NutritionWaterCard";
import NutritionCalendar, {
  NutritionCalendarDayData,
} from "@/src/components/ui/NutritionCalendar";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useLanguage } from "@/src/contexts/languageContext";
import { useNutrition } from "@/src/contexts/nutritionContext";
import useReduceMotion from "@/src/hooks/useReduceMotion";
import { getMealLabel, MONTH_NAMES } from "@/src/i18n/translations";
import {
  batchGetCachedNutritionDays,
  cacheNutritionDay,
  getCachedNutritionForDate,
  getNutritionCacheKey,
} from "@/src/services/cacheService";
import {
  getCachedNutritionCalendarSummary,
  NutritionCalendarSummary,
  setCachedNutritionCalendarSummary,
  upsertNutritionCalendarSummaryDay,
} from "@/src/services/nutritionCalendarCacheService";
import {
  awaitNutritionCalendarPrefetch,
  getDailyNutrition,
  getMemoryEarliestDate,
  getUserNutritionEarliestDate,
  getNutritionForDateRange,
} from "@/src/services/nutritionService";
import { DailyNutrition, Food } from "@/src/types/index";
import { startOfDay, toDateKey, toValidDate } from "@/src/utils/dateKey";
import { measureAsync } from "@/src/utils/perf";
import { trackScreen, trackDataLoad, trackCacheHit, trackCacheMiss } from "@/src/utils/perfMonitor";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MEALS = ["Mic Dejun", "Pranz", "Cina", "Gustari"] as const;

type FoodWithOptionalBrand = Food & { brand?: string };
type DayData = NutritionCalendarDayData;
type CalendarScrollRequest = {
  date: Date;
  animated: boolean;
  reason?: "selection";
};

const DEFAULT_GOALS = {
  calorie: 2500,
  protein: 150,
  carbs: 250,
  fat: 70,
};
const CALENDAR_FUTURE_DAYS = 7;
const CALENDAR_INITIAL_BACK_DAYS = 35;
const CALENDAR_PRELOAD_WEEKS_BEFORE = 1;
const CALENDAR_PRELOAD_WEEKS_AFTER = 1;

const CIRCUMFERENCE = 2 * Math.PI * 40;

const toDayLookupKey = (date: Date): string => toDateKey(startOfDay(date));

const toMonthLookupKey = (date: Date): string =>
  `${date.getFullYear()}-${date.getMonth()}`;

const normalizeDate = (date: Date | string): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const startOfCalendarWeek = (date: Date): Date => {
  const normalized = startOfDay(date);
  const day = normalized.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + mondayOffset);
  return normalized;
};

const endOfCalendarWeek = (date: Date): Date => {
  const start = startOfCalendarWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(0, 0, 0, 0);
  return end;
};

const buildCalendarWindowDates = (
  anchorDate: Date,
  options?: {
    weeksBefore?: number;
    weeksAfter?: number;
    maxDate?: Date;
  },
): Date[] => {
  const normalizedAnchor = startOfDay(anchorDate);
  const weekStart = startOfCalendarWeek(normalizedAnchor);
  const weeksBefore = options?.weeksBefore ?? 0;
  const weeksAfter = options?.weeksAfter ?? 0;
  const maxDate =
    options?.maxDate && options.maxDate instanceof Date
      ? startOfDay(options.maxDate)
      : null;

  const windowStart = new Date(weekStart);
  windowStart.setDate(weekStart.getDate() - weeksBefore * 7);
  windowStart.setHours(0, 0, 0, 0);

  const windowEnd = new Date(weekStart);
  windowEnd.setDate(weekStart.getDate() + weeksAfter * 7 + 6);
  windowEnd.setHours(0, 0, 0, 0);

  const result: Date[] = [];
  for (
    let day = new Date(windowStart);
    day <= windowEnd;
    day.setDate(day.getDate() + 1)
  ) {
    const normalizedDay = startOfDay(day);
    if (maxDate && normalizedDay > maxDate) {
      continue;
    }
    result.push(new Date(normalizedDay));
  }

  return result;
};

const formatHeaderDateLabel = (date: Date, language: "en" | "ro"): string => {
  const normalizedDate = startOfDay(date);
  const monthName = MONTH_NAMES[language][normalizedDate.getMonth()] || "";
  const shortMonth = monthName.slice(0, 3);
  const normalizedMonth = shortMonth
    ? shortMonth.charAt(0).toUpperCase() + shortMonth.slice(1)
    : "";
  return `${normalizedDate.getDate()} ${normalizedMonth}, ${normalizedDate.getFullYear()}`;
};

const formatMonthYearLabel = (date: Date, language: "en" | "ro"): string => {
  const normalizedDate = startOfDay(date);
  const monthName = MONTH_NAMES[language][normalizedDate.getMonth()] || "";
  const normalizedMonthName = monthName
    ? monthName.charAt(0).toUpperCase() + monthName.slice(1)
    : "";
  return `${normalizedMonthName} ${normalizedDate.getFullYear()}`;
};

const buildCalendarDays = (earliestDate: Date | null): Date[] => {
  const today = startOfDay(new Date());
  const endAnchor = new Date(today);
  endAnchor.setDate(endAnchor.getDate() + CALENDAR_FUTURE_DAYS);
  const endDate = endOfCalendarWeek(endAnchor);

  let startAnchor = earliestDate
    ? new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1)
    : new Date(today);

  if (!earliestDate) {
    startAnchor.setDate(startAnchor.getDate() - CALENDAR_INITIAL_BACK_DAYS);
    startAnchor.setHours(0, 0, 0, 0);
  }

  const startDate = startOfCalendarWeek(startAnchor);

  const days: Date[] = [];
  for (
    let day = new Date(startDate);
    day <= endDate;
    day.setDate(day.getDate() + 1)
  ) {
    days.push(new Date(day));
  }

  return days;
};

const areCalendarDaysEqual = (left: Date[], right: Date[]): boolean => {
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index += 1) {
    if (left[index].getTime() !== right[index].getTime()) {
      return false;
    }
  }

  return true;
};

const hasOnlyEmptyMeals = (nutritionDay: DailyNutrition): boolean => {
  const meals = Array.isArray(nutritionDay.meals) ? nutritionDay.meals : [];
  if (meals.length === 0) return true;
  return meals.every(
    (meal) => !Array.isArray(meal.foods) || meal.foods.length === 0,
  );
};

const isSyntheticEmptyNutritionFallback = (
  nutritionDay: DailyNutrition,
): boolean =>
  !nutritionDay.id &&
  !nutritionDay.localUpdatedAt &&
  hasOnlyEmptyMeals(nutritionDay);

const sumNutritionCalories = (nutritionDay: DailyNutrition): number => {
  const meals = Array.isArray(nutritionDay.meals) ? nutritionDay.meals : [];
  return meals.reduce((total, meal) => {
    const foods = Array.isArray(meal.foods) ? meal.foods : [];
    return (
      total + foods.reduce((sum, food) => sum + (Number(food.calories) || 0), 0)
    );
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
    const foods = ((meal?.foods as FoodWithOptionalBrand[]) || []).map(
      (food) => ({
        ...food,
      }),
    );

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
      calories: foods.reduce(
        (sum, food) => sum + (Number(food.calories) || 0),
        0,
      ),
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
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();

  const mountStartRef = useRef(Date.now());

  useEffect(() => {
    trackScreen("Nutrition", Date.now() - mountStartRef.current);
  }, []);
  const {
    todayNutrition,
    todayWater,
    refreshNutrition,
    addWaterIntake,
    resetWaterIntake,
    removeWaterIntake,
    removeFoodFromMeal,
    updateFoodQuantity,
    copyFoodToMeal,
    moveFoodToMeal,
  } = useNutrition();

  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    startOfDay(new Date()),
  );
  const [visibleCalendarDate, setVisibleCalendarDate] = useState<Date>(() =>
    startOfDay(new Date()),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [daysData, setDaysData] = useState<DayData[]>([]);
  const [calendarDays, setCalendarDays] = useState<Date[]>(() =>
    buildCalendarDays(null),
  );
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarEarliestDate, setCalendarEarliestDate] = useState<Date | null>(
    null,
  );
  const [calendarScrollRequest, setCalendarScrollRequest] =
    useState<CalendarScrollRequest | null>(null);
  const [showCalendarLogModal, setShowCalendarLogModal] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFood, setEditingFood] = useState<EditableFoodState>(null);
  const [editQuantity, setEditQuantity] = useState("");

  const [showActionsModal, setShowActionsModal] = useState(false);
  const [actionFood, setActionFood] = useState<EditableFoodState>(null);

  const calendarRequestIdRef = useRef(0);
  const initialLoadUserIdRef = useRef<string | null>(null);
  const previousCalendarUserIdRef = useRef<string | null>(null);
  const calendarBootStartedAtRef = useRef(Date.now());
  const lastVisibleCalendarDayRef = useRef<Date | null>(null);
  const lastVisibleCalendarMonthKeyRef = useRef<string | null>(
    toMonthLookupKey(startOfDay(new Date())),
  );
  const loadedDayKeysRef = useRef<Set<string>>(new Set());
  const pendingDayKeysRef = useRef<Set<string>>(new Set());
  const lastDaysDataChangeReasonRef = useRef<string>("initial");
  const lastCalendarDaysChangeReasonRef = useRef<string>("initial");
  const previousCalendarCountsRef = useRef<{
    calendarDays: number;
    daysData: number;
  }>({
    calendarDays: calendarDays.length,
    daysData: daysData.length,
  });
  const loggedWeekKeysRef = useRef<Set<string>>(new Set());

  const devLog = useCallback(
    (event: string, payload?: Record<string, unknown>) => {
      if (!__DEV__) return;
      console.log(event, payload ?? {});
    },
    [],
  );

  const mealSummaries = useMemo(
    () => buildMealSummaries(todayNutrition?.meals),
    [todayNutrition?.meals],
  );

  const nutritionStats = useMemo<NutritionStats>(() => {
    const totalCalories = mealSummaries.reduce(
      (sum, meal) => sum + meal.calories,
      0,
    );
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
      overCalories: Math.max(totalCalories - calorieGoal, 0),
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

  const dateHeaderLabel = useMemo(
    () => formatHeaderDateLabel(selectedDate, language),
    [language, selectedDate],
  );

  const calendarMonthLabel = useMemo(
    () => formatMonthYearLabel(visibleCalendarDate, language),
    [language, visibleCalendarDate],
  );

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
    const selectedKey = toDayLookupKey(startOfDay(selectedDate));
    const selectedIndex = calendarDays.findIndex(
      (day) => toDayLookupKey(day) === selectedKey,
    );
    if (selectedIndex !== -1) return selectedIndex;

    const todayKey = toDayLookupKey(startOfDay(new Date()));
    const todayIndex = calendarDays.findIndex(
      (day) => toDayLookupKey(day) === todayKey,
    );
    if (todayIndex !== -1) return todayIndex;
    return Math.max(calendarDays.length - 1, 0);
  }, [calendarDays, selectedDate]);

  const maxPlannableDate = useMemo(() => {
    const planningAnchor = startOfDay(new Date());
    planningAnchor.setDate(planningAnchor.getDate() + CALENDAR_FUTURE_DAYS);
    return endOfCalendarWeek(planningAnchor);
  }, []);

  const calendarHasFuture2Days = useMemo(
    () => mainCalendarInitialIndex + 2 < calendarDays.length,
    [calendarDays.length, mainCalendarInitialIndex],
  );

  const logCalendarWeekLoaded = useCallback(
    (date: Date, source: "cache" | "remote" | "empty") => {
      if (!__DEV__) return;
      const weekStart = startOfCalendarWeek(date);
      const weekKey = toDayLookupKey(weekStart);
      if (loggedWeekKeysRef.current.has(weekKey)) return;
      loggedWeekKeysRef.current.add(weekKey);
      const weekEnd = endOfCalendarWeek(weekStart);
      devLog("calendar_week_loaded", {
        weekStart: toDateKey(weekStart),
        weekEnd: toDateKey(weekEnd),
        source,
      });
    },
    [devLog],
  );

  const upsertCalendarDayData = useCallback(
    (date: Date, calories: number, goal: number) => {
      const normalizedDate = startOfDay(date);
      const dayLookupKey = toDayLookupKey(normalizedDate);
      lastDaysDataChangeReasonRef.current = "upsert_calendar_day";

      setDaysData((previousDaysData) => {
        const existingIndex = previousDaysData.findIndex(
          (day) => toDayLookupKey(day.date) === dayLookupKey,
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

      loadedDayKeysRef.current.add(toDateKey(normalizedDate));

      if (user?.uid) {
        void upsertNutritionCalendarSummaryDay(user.uid, {
          date: normalizedDate,
          calories,
          goal,
        });
      }
    },
    [user?.uid],
  );

  useEffect(() => {
    if (calendarDays.length === 0) return;

    devLog("calendar_ready", {
      latencyMs: Date.now() - calendarBootStartedAtRef.current,
      dayCount: calendarDays.length,
      initialIndex: mainCalendarInitialIndex,
      hasFuture2Days: calendarHasFuture2Days,
      selectedDateKey: toDayLookupKey(selectedDate),
    });
  }, [
    calendarDays.length,
    calendarHasFuture2Days,
    devLog,
    mainCalendarInitialIndex,
    selectedDate,
  ]);

  const applyCalendarSummary = useCallback(
    (
      summary: NutritionCalendarSummary | null,
      reason: "hydrate_cache" | "seed_remote" | "reset" = "hydrate_cache",
    ) => {
      if (!summary) {
        setCalendarEarliestDate(null);
        lastCalendarDaysChangeReasonRef.current = `summary_${reason}_reset`;
        setCalendarDays(buildCalendarDays(null));
        lastDaysDataChangeReasonRef.current = `summary_${reason}_reset`;
        setDaysData([]);
        loadedDayKeysRef.current.clear();
        pendingDayKeysRef.current.clear();
        devLog("calendar_apply_summary", {
          reason,
          incomingDays: 0,
          previousDays: 0,
          mergedDays: 0,
          earliestDate: null,
        });
        return;
      }

      const earliestDate = summary.earliestDate
        ? startOfDay(new Date(summary.earliestDate))
        : null;
      setCalendarEarliestDate(earliestDate);

      // Set calendarDays directly so React batches it with earliestDate,
      // avoiding a visible 49->147 day rebuild flash.
      const nextCalendarDays = buildCalendarDays(earliestDate);
      setCalendarDays((previousDays) => {
        if (areCalendarDaysEqual(previousDays, nextCalendarDays)) {
          return previousDays;
        }
        lastCalendarDaysChangeReasonRef.current = `summary_${reason}`;
        return nextCalendarDays;
      });

      const mappedDaysData: DayData[] = summary.days.map((day) => ({
        date: startOfDay(new Date(day.date)),
        calories: Number(day.calories) || 0,
        goal: Number(day.goal) || DEFAULT_GOALS.calorie,
      }));

      setDaysData((previousDaysData) => {
        if (mappedDaysData.length === 0) {
          devLog("calendar_apply_summary_metadata_only", {
            reason,
            incomingDays: 0,
            retainedDays: previousDaysData.length,
            earliestDate: earliestDate ? toDateKey(earliestDate) : null,
          });
          return previousDaysData;
        }

        lastDaysDataChangeReasonRef.current = `summary_${reason}`;
        const mergedByKey = new Map<string, DayData>();
        for (const day of mappedDaysData) {
          mergedByKey.set(toDateKey(day.date), day);
        }
        for (const day of previousDaysData) {
          mergedByKey.set(toDateKey(day.date), day);
        }
        const mergedDaysData = [...mergedByKey.values()].sort(
          (left, right) => left.date.getTime() - right.date.getTime(),
        );

        loadedDayKeysRef.current = new Set(
          mergedDaysData.map((day) => toDateKey(day.date)),
        );

        devLog("calendar_apply_summary", {
          reason,
          incomingDays: mappedDaysData.length,
          previousDays: previousDaysData.length,
          mergedDays: mergedDaysData.length,
          earliestDate: earliestDate ? toDateKey(earliestDate) : null,
        });

        return mergedDaysData;
      });
    },
    [devLog],
  );

  useEffect(() => {
    const previousCounts = previousCalendarCountsRef.current;
    const nextCounts = {
      calendarDays: calendarDays.length,
      daysData: daysData.length,
    };

    const calendarDaysChanged =
      previousCounts.calendarDays !== nextCounts.calendarDays;
    const daysDataChanged = previousCounts.daysData !== nextCounts.daysData;

    if (!calendarDaysChanged && !daysDataChanged) {
      return;
    }

    devLog("calendar_state_transition", {
      previousCalendarDays: previousCounts.calendarDays,
      nextCalendarDays: nextCounts.calendarDays,
      previousDaysData: previousCounts.daysData,
      nextDaysData: nextCounts.daysData,
      calendarDaysReason: calendarDaysChanged
        ? lastCalendarDaysChangeReasonRef.current
        : null,
      daysDataReason: daysDataChanged
        ? lastDaysDataChangeReasonRef.current
        : null,
    });

    if (calendarDaysChanged) {
      lastCalendarDaysChangeReasonRef.current = "idle";
    }
    if (daysDataChanged) {
      lastDaysDataChangeReasonRef.current = "idle";
    }

    previousCalendarCountsRef.current = nextCounts;
  }, [calendarDays.length, daysData.length, devLog]);

  const loadCalendarDaySummary = useCallback(
    async (
      date: Date,
      options?: {
        force?: boolean;
        forceRemote?: boolean;
      },
    ) => {
      const userId = user?.uid;
      if (!userId) return;

      const force = options?.force ?? false;
      const forceRemote = options?.forceRemote ?? false;
      const normalizedDate = startOfDay(date);
      if (normalizedDate > maxPlannableDate) return;

      const dateKey = toDateKey(normalizedDate);
      if (!force && loadedDayKeysRef.current.has(dateKey)) return;
      if (pendingDayKeysRef.current.has(dateKey)) return;

      pendingDayKeysRef.current.add(dateKey);

      try {
        let hasCachedSnapshot = false;
        const cached = await getCachedNutritionForDate(normalizedDate);
        if (cached) {
          trackCacheHit("nutrition_day", 0);
          hasCachedSnapshot = true;
          const calories = sumNutritionCalories(cached);
          const goal = cached.calorieGoal || DEFAULT_GOALS.calorie;
          upsertCalendarDayData(normalizedDate, calories, goal);
          logCalendarWeekLoaded(normalizedDate, "cache");
          if (!forceRemote) {
            return;
          }
        } else {
          trackCacheMiss("nutrition_day");
        }

        const start = Date.now();
        const remoteResult = await getDailyNutrition(userId, normalizedDate);
        trackDataLoad("nutrition_day", "firebase", Date.now() - start, remoteResult.success && remoteResult.data ? 1 : 0);
        if (remoteResult.success && remoteResult.data) {
          const nutrition = remoteResult.data as DailyNutrition;
          const calories = sumNutritionCalories(nutrition);
          const goal = nutrition.calorieGoal || DEFAULT_GOALS.calorie;

          upsertCalendarDayData(normalizedDate, calories, goal);
          void cacheNutritionDay(normalizedDate, nutrition);
          logCalendarWeekLoaded(normalizedDate, "remote");
          return;
        }

        if (!hasCachedSnapshot) {
          loadedDayKeysRef.current.add(dateKey);
          logCalendarWeekLoaded(normalizedDate, "empty");
        }
      } catch (error) {
        if (__DEV__) {
          console.error("[Nutrition] Error loading calendar day summary:", error);
        }
      } finally {
        pendingDayKeysRef.current.delete(dateKey);
      }
    },
    [logCalendarWeekLoaded, maxPlannableDate, upsertCalendarDayData, user?.uid],
  );

  const loadCalendarDaysBatch = useCallback(
    async (
      dates: Date[],
      options?: { force?: boolean; forceRemote?: boolean },
    ) => {
      const userId = user?.uid;
      if (!userId || dates.length === 0) return;

      const force = options?.force ?? false;
      const forceRemote = options?.forceRemote ?? false;

      // Deduplicate and filter out already-loaded / out-of-range dates
      const uniqueDays = new Map<string, Date>();
      for (const date of dates) {
        const normalized = startOfDay(date);
        if (normalized > maxPlannableDate) continue;
        const dk = toDateKey(normalized);
        if (!force && loadedDayKeysRef.current.has(dk)) continue;
        if (pendingDayKeysRef.current.has(dk)) continue;
        uniqueDays.set(dk, normalized);
      }

      if (uniqueDays.size === 0) return;

      const datesToLoad = [...uniqueDays.values()];
      for (const d of datesToLoad) {
        pendingDayKeysRef.current.add(toDateKey(d));
      }

      try {
        // --- Phase A: batch cache read (single multiGet) ---
        const cacheMap = await batchGetCachedNutritionDays(datesToLoad);

        const cacheHits: DayData[] = [];
        const cacheMissDates: Date[] = [];

        for (const date of datesToLoad) {
          const key = getNutritionCacheKey(date);
          const cached = cacheMap.get(key);

          if (cached) {
            trackCacheHit("nutrition_day", 0);
            const calories = sumNutritionCalories(cached);
            const goal = cached.calorieGoal || DEFAULT_GOALS.calorie;
            cacheHits.push({ date, calories, goal });
            logCalendarWeekLoaded(date, "cache");
          } else {
            trackCacheMiss("nutrition_day");
            cacheMissDates.push(date);
          }
        }

        // Single state update for all cache hits
        if (cacheHits.length > 0) {
          lastDaysDataChangeReasonRef.current = "batch_cache_hits";
          setDaysData((prev) => {
            const merged = new Map<string, DayData>();
            for (const day of prev) {
              merged.set(toDayLookupKey(day.date), day);
            }
            for (const hit of cacheHits) {
              const dk = toDayLookupKey(hit.date);
              const existing = merged.get(dk);
              if (
                existing &&
                existing.calories === hit.calories &&
                existing.goal === hit.goal
              ) {
                continue;
              }
              merged.set(dk, hit);
            }
            if (merged.size === prev.length) {
              // Check if any values actually changed
              let anyChanged = false;
              for (const hit of cacheHits) {
                const dk = toDayLookupKey(hit.date);
                const existing = prev.find(
                  (d) => toDayLookupKey(d.date) === dk,
                );
                if (
                  !existing ||
                  existing.calories !== hit.calories ||
                  existing.goal !== hit.goal
                ) {
                  anyChanged = true;
                  break;
                }
              }
              if (!anyChanged) return prev;
            }
            return [...merged.values()];
          });

          for (const hit of cacheHits) {
            loadedDayKeysRef.current.add(toDateKey(hit.date));
          }

          if (userId) {
            for (const hit of cacheHits) {
              void upsertNutritionCalendarSummaryDay(userId, {
                date: hit.date,
                calories: hit.calories,
                goal: hit.goal,
              });
            }
          }
        }

        // If no remote needed, mark cache misses as loaded (empty) and return
        if (!forceRemote && cacheMissDates.length === 0) return;

        // --- Phase B: single batch remote fetch for cache misses ---
        const remoteDates = forceRemote ? datesToLoad : cacheMissDates;
        if (remoteDates.length === 0) return;

        const minDate = startOfDay(new Date(Math.min(...remoteDates.map((d) => d.getTime()))));
        const maxDate = new Date(Math.max(...remoteDates.map((d) => d.getTime())));
        maxDate.setHours(23, 59, 59, 999);

        const start = Date.now();
        const batchResult = await getNutritionForDateRange(userId, minDate, maxDate);
        trackDataLoad(
          "nutrition_range",
          "firebase",
          Date.now() - start,
          batchResult.success && Array.isArray(batchResult.data) ? batchResult.data.length : 0,
        );

        const remoteResults = [];
        if (batchResult.success && Array.isArray(batchResult.data)) {
          const dataMap = new Map<string, DailyNutrition>();
          for (const item of batchResult.data) {
            dataMap.set(toDateKey(item.date), item);
          }

          for (const date of remoteDates) {
            const dateKey = toDateKey(date);
            const nutrition = dataMap.get(dateKey);
            if (nutrition) {
              void cacheNutritionDay(date, nutrition);
              remoteResults.push({
                date,
                calories: sumNutritionCalories(nutrition),
                goal: nutrition.calorieGoal || DEFAULT_GOALS.calorie,
              });
            } else {
              remoteResults.push(null);
            }
          }
        } else {
          for (const date of remoteDates) {
            remoteResults.push(null);
          }
        }

        const remoteHits = remoteResults.filter(
          (r): r is DayData => r !== null,
        );

        // Single state update for all remote results
        if (remoteHits.length > 0) {
          lastDaysDataChangeReasonRef.current = "batch_remote_hits";
          setDaysData((prev) => {
            const merged = new Map<string, DayData>();
            for (const day of prev) {
              merged.set(toDayLookupKey(day.date), day);
            }
            for (const hit of remoteHits) {
              merged.set(toDayLookupKey(hit.date), hit);
              logCalendarWeekLoaded(hit.date, "remote");
            }
            return [...merged.values()];
          });

          if (userId) {
            for (const hit of remoteHits) {
              void upsertNutritionCalendarSummaryDay(userId, {
                date: hit.date,
                calories: hit.calories,
                goal: hit.goal,
              });
            }
          }
        }

        // Mark all dates as loaded
        for (const date of datesToLoad) {
          loadedDayKeysRef.current.add(toDateKey(date));
        }
      } catch (error) {
        if (__DEV__) {
          console.error("[Nutrition] Error in batch calendar load:", error);
        }
      } finally {
        for (const date of datesToLoad) {
          pendingDayKeysRef.current.delete(toDateKey(date));
        }
      }
    },
    [logCalendarWeekLoaded, maxPlannableDate, user?.uid],
  );

  const preloadCalendarDates = useCallback(
    (
      dates: Date[],
      options?: {
        force?: boolean;
        forceRemote?: boolean;
      },
    ) => {
      if (dates.length === 0) return;
      void loadCalendarDaysBatch(dates, options);
    },
    [loadCalendarDaysBatch],
  );

  const requestCalendarWindowLoad = useCallback(
    (
      date: Date,
      options?: {
        force?: boolean;
        forceRemote?: boolean;
      },
    ) => {
      const datesToLoad = buildCalendarWindowDates(date, {
        weeksBefore: CALENDAR_PRELOAD_WEEKS_BEFORE,
        weeksAfter: CALENDAR_PRELOAD_WEEKS_AFTER,
        maxDate: maxPlannableDate,
      });
      preloadCalendarDates(datesToLoad, options);
    },
    [maxPlannableDate, preloadCalendarDates],
  );

  // Keep nearby weeks warm so rings are already filled when the user swipes.
  useEffect(() => {
    if (!user?.uid) return;
    requestCalendarWindowLoad(selectedDate, { force: true });
  }, [requestCalendarWindowLoad, selectedDate, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    requestCalendarWindowLoad(visibleCalendarDate);
  }, [requestCalendarWindowLoad, user?.uid, visibleCalendarDate]);

  const loadNutritionData = useCallback(
    async (date: Date, options?: Parameters<typeof refreshNutrition>[1]) => {
      if (!user?.uid) return;

      try {
        await refreshNutrition(date, options);
      } catch (error) {
        if (__DEV__) {
          console.error("[Nutrition] Error refreshing selected date:", error);
        }
      }
    },
    [refreshNutrition, user?.uid],
  );

  const loadCalendarHistory = useCallback(
    async (options?: { forceRemote?: boolean }) => {
      const userId = user?.uid;
      const forceRemote = options?.forceRemote ?? false;
      calendarRequestIdRef.current += 1;
      const requestId = calendarRequestIdRef.current;
      let cachedSummary: NutritionCalendarSummary | null = null;

      if (!userId) {
        lastDaysDataChangeReasonRef.current = "history_no_user_reset";
        setDaysData([]);
        setCalendarEarliestDate(null);
        setCalendarLoading(false);
        return;
      }

      const memEarliest = getMemoryEarliestDate(userId);
      if (memEarliest !== undefined && memEarliest) {
        const memDate = startOfDay(new Date(memEarliest));
        setCalendarEarliestDate(memDate);
        const memDays = buildCalendarDays(memDate);
        setCalendarDays((prev) =>
          areCalendarDaysEqual(prev, memDays) ? prev : memDays,
        );
      }

      const cacheResult = await measureAsync(
        "nutrition_calendar_hydrate_cache_ms",
        () => getCachedNutritionCalendarSummary(userId, { allowStale: true }),
        (result) => ({
          source: result.data
            ? result.data.days.length > 0
              ? "cache"
              : result.data.earliestDate
                ? "cache_metadata"
                : "fallback"
            : "fallback",
          itemCount: result.data?.days.length ?? 0,
          hasEarliestDate: Boolean(result.data?.earliestDate),
          cacheAgeMs: result.ageMs ?? null,
          success: Boolean(
            result.data &&
            (result.data.days.length > 0 || result.data.earliestDate),
          ),
        }),
      );

      if (requestId !== calendarRequestIdRef.current) return;

      if (cacheResult.data) {
        trackCacheHit("nutrition_calendar_summary", cacheResult.ageMs ?? 0);
        cachedSummary = cacheResult.data;
        applyCalendarSummary(cacheResult.data, "hydrate_cache");
      } else {
        trackCacheMiss("nutrition_calendar_summary");
      }

      await awaitNutritionCalendarPrefetch();
      if (requestId !== calendarRequestIdRef.current) return;

      const cachedEarliest = cachedSummary?.earliestDate ?? null;
      if (cachedEarliest && !forceRemote) {
        setCalendarLoading(false);
        return;
      }

      try {
        const start = Date.now();
        const earliestDate = await measureAsync(
          "nutrition_calendar_seed_remote_ms",
          () => getUserNutritionEarliestDate(userId),
          (result) => ({
            source: result ? "remote" : "fallback",
            itemCount: 0,
            cacheAgeMs: null,
            success: Boolean(result),
          }),
        );
        trackDataLoad("nutrition_earliest_date", "firebase", Date.now() - start, earliestDate ? 1 : 0);

        if (requestId !== calendarRequestIdRef.current) return;

        const earliestIso = earliestDate
          ? startOfDay(earliestDate).toISOString()
          : null;
        const nextSummary = cachedSummary
          ? {
              ...cachedSummary,
              earliestDate: earliestIso ?? cachedSummary.earliestDate,
            }
          : {
              userID: userId,
              earliestDate: earliestIso,
              days: [],
              updatedAt: Date.now(),
            };

        if (nextSummary.earliestDate || cachedSummary) {
          applyCalendarSummary(nextSummary, "seed_remote");
          await setCachedNutritionCalendarSummary(userId, {
            earliestDate: nextSummary.earliestDate,
            days: nextSummary.days,
          });
        } else if (!cachedSummary) {
          lastDaysDataChangeReasonRef.current = "history_remote_empty_reset";
          setDaysData([]);
          setCalendarEarliestDate(null);
        }
      } catch (error) {
        if (__DEV__) {
          console.error("[Nutrition] Error loading calendar seed:", error);
        }
        if (requestId !== calendarRequestIdRef.current) return;

        if (!cachedSummary) {
          lastDaysDataChangeReasonRef.current = "history_seed_error_reset";
          setDaysData([]);
          setCalendarEarliestDate(null);
        }
      } finally {
        if (requestId === calendarRequestIdRef.current) {
          setCalendarLoading(false);
        }
      }
    },
    [applyCalendarSummary, user?.uid],
  );

  useEffect(() => {
    if (user?.uid && previousCalendarUserIdRef.current !== user.uid) {
      calendarBootStartedAtRef.current = Date.now();
      lastDaysDataChangeReasonRef.current = "user_switch_reset";
      setDaysData([]);
      setCalendarEarliestDate(null);
      setCalendarLoading(true);
      setCalendarScrollRequest(null);
      lastVisibleCalendarDayRef.current = null;
      lastVisibleCalendarMonthKeyRef.current = null;
      loadedDayKeysRef.current.clear();
      pendingDayKeysRef.current.clear();
    }
    previousCalendarUserIdRef.current = user?.uid || null;

    if (!user?.uid) {
      calendarBootStartedAtRef.current = Date.now();
      lastDaysDataChangeReasonRef.current = "user_signed_out_reset";
      setDaysData([]);
      setCalendarEarliestDate(null);
      setCalendarLoading(false);
      setRefreshing(false);
      setShowCalendarLogModal(false);
      setCalendarScrollRequest(null);
      lastVisibleCalendarDayRef.current = null;
      lastVisibleCalendarMonthKeyRef.current = null;
      loadedDayKeysRef.current.clear();
      pendingDayKeysRef.current.clear();
      initialLoadUserIdRef.current = null;
      return;
    }

    const isInitialLoadForUser = initialLoadUserIdRef.current !== user.uid;
    initialLoadUserIdRef.current = user.uid;

    void loadNutritionData(selectedDate, {
      forceRemote: false,
      preloadWeek: isInitialLoadForUser,
      reason: isInitialLoadForUser ? "screen_mount" : "date_switch",
    });
  }, [loadNutritionData, selectedDate, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    void loadCalendarHistory();
  }, [loadCalendarHistory, user?.uid]);

  useEffect(() => {
    if (!todayNutrition) return;

    const nutritionDate = toValidDate(todayNutrition.date);
    if (!nutritionDate) return;

    const normalizedDate = startOfDay(nutritionDate);
    if (normalizedDate > maxPlannableDate) return;

    const nutritionDateKey = toDayLookupKey(normalizedDate);
    const calories = nutritionStats.totalCalories;
    const goal = todayNutrition.calorieGoal || DEFAULT_GOALS.calorie;
    const isFallbackEmptySnapshot =
      calories === 0 && isSyntheticEmptyNutritionFallback(todayNutrition);

    lastDaysDataChangeReasonRef.current = "sync_today_nutrition";
    setDaysData((previousDaysData) => {
      const existingIndex = previousDaysData.findIndex(
        (day) => toDayLookupKey(day.date) === nutritionDateKey,
      );

      if (existingIndex !== -1) {
        const existing = previousDaysData[existingIndex];
        if (isFallbackEmptySnapshot && existing.calories > 0) {
          return previousDaysData;
        }
        if (existing.calories === calories && existing.goal === goal) {
          return previousDaysData;
        }

        const updated = [...previousDaysData];
        updated[existingIndex] = { ...existing, calories, goal };
        return updated;
      }

      if (isFallbackEmptySnapshot) {
        return previousDaysData;
      }

      return [...previousDaysData, { date: normalizedDate, calories, goal }];
    });

    if (!isFallbackEmptySnapshot) {
      loadedDayKeysRef.current.add(toDateKey(normalizedDate));
    }

    if (!isFallbackEmptySnapshot && user?.uid) {
      void upsertNutritionCalendarSummaryDay(user.uid, {
        date: normalizedDate,
        calories,
        goal,
      });
    }
  }, [
    maxPlannableDate,
    nutritionStats.totalCalories,
    todayNutrition,
    user?.uid,
  ]);

  useEffect(() => {
    return () => {
      calendarRequestIdRef.current += 1;
      // Clear accumulated week keys to prevent memory leak
      loggedWeekKeysRef.current.clear();
    };
  }, []);

  const onRefresh = useCallback(() => {
    calendarBootStartedAtRef.current = Date.now();
    loadedDayKeysRef.current.clear();
    pendingDayKeysRef.current.clear();
    setRefreshing(true);

    void (async () => {
      try {
        await Promise.all([
          loadNutritionData(selectedDate, {
            forceRemote: true,
            preloadWeek: true,
            reason: "pull_to_refresh",
          }),
          loadCalendarHistory({ forceRemote: true }),
        ]);
        requestCalendarWindowLoad(selectedDate, {
          force: true,
          forceRemote: true,
        });
      } finally {
        setRefreshing(false);
      }
    })();
  }, [
    loadCalendarHistory,
    loadNutritionData,
    requestCalendarWindowLoad,
    selectedDate,
  ]);

  const updateVisibleCalendarMonth = useCallback((date: Date) => {
    const normalizedDate = startOfDay(date);
    const monthKey = toMonthLookupKey(normalizedDate);
    lastVisibleCalendarMonthKeyRef.current = monthKey;
    setVisibleCalendarDate((previousDate) =>
      toMonthLookupKey(previousDate) === monthKey
        ? previousDate
        : normalizedDate,
    );
  }, []);

  const handleDayPress = useCallback(
    (day: Date, _index?: number) => {
      const normalizedDay = normalizeDate(day);
      if (normalizedDay > maxPlannableDate) return;

      setCalendarScrollRequest(null);
      lastVisibleCalendarDayRef.current = normalizedDay;
      updateVisibleCalendarMonth(normalizedDay);
      setSelectedDate((previousDate) => {
        if (toDayLookupKey(normalizedDay) === toDayLookupKey(previousDate)) {
          return previousDate;
        }
        return normalizedDay;
      });
    },
    [maxPlannableDate, updateVisibleCalendarMonth],
  );

  const handleOpenSettings = useCallback(() => {
    router.push("/(modals)/nutritionSettings");
  }, [router]);

  const handleOpenMaintenance = useCallback(() => {
    router.push("/(modals)/maintenanceTracker");
  }, [router]);

  const handleOpenCalendarLog = useCallback(() => {
    setShowCalendarLogModal(true);
  }, []);

  const handleCloseCalendarLog = useCallback(() => {
    setShowCalendarLogModal(false);
  }, []);

  const handleCalendarModalDayPress = useCallback(
    (day: Date, _index?: number) => {
      const normalizedDate = startOfDay(day);
      if (normalizedDate > maxPlannableDate) return;

      lastVisibleCalendarDayRef.current = normalizedDate;
      updateVisibleCalendarMonth(normalizedDate);
      setCalendarScrollRequest({
        date: normalizedDate,
        animated: true,
        reason: "selection",
      });
      setSelectedDate((previousDate) => {
        if (toDayLookupKey(normalizedDate) === toDayLookupKey(previousDate)) {
          return previousDate;
        }
        return normalizedDate;
      });
    },
    [maxPlannableDate, updateVisibleCalendarMonth],
  );

  const handleCalendarScrollHandled = useCallback((_date: Date) => {
    setCalendarScrollRequest(null);
  }, []);

  const handleCalendarVisibleDayChange = useCallback(
    (day: Date) => {
      const normalizedDay = startOfDay(day);
      if (
        lastVisibleCalendarDayRef.current &&
        toDateKey(lastVisibleCalendarDayRef.current) ===
          toDateKey(normalizedDay)
      ) {
        return;
      }

      lastVisibleCalendarDayRef.current = normalizedDay;
      requestCalendarWindowLoad(normalizedDay);

      const monthKey = toMonthLookupKey(normalizedDay);
      if (lastVisibleCalendarMonthKeyRef.current === monthKey) {
        return;
      }

      lastVisibleCalendarMonthKeyRef.current = monthKey;
      setVisibleCalendarDate((previousDate) =>
        toMonthLookupKey(previousDate) === monthKey
          ? previousDate
          : normalizedDay,
      );
    },
    [requestCalendarWindowLoad],
  );

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

  const handleRemoveWater = useCallback(
    async (index: number) => {
      try {
        await removeWaterIntake(index);
      } catch (error: any) {
        Alert.alert(t("common_error"), error?.message || "Error deleting water entry");
      }
    },
    [removeWaterIntake, t],
  );

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
    if (
      !editingFood ||
      !Number.isFinite(parsedQuantity) ||
      parsedQuantity <= 0
    ) {
      Alert.alert(t("common_error"), t("nutrition_invalid_quantity"));
      return;
    }

    await updateFoodQuantity(
      editingFood.mealName,
      editingFood.foodIndex,
      parsedQuantity,
    );
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
            onOpenMaintenance={handleOpenMaintenance}
          />

          <Typo size={32} variant="heading" style={styles.calendarMonthTitle}>
            {calendarMonthLabel}
          </Typo>

          <NutritionCalendar
            calendarDays={calendarDays}
            daysData={daysData}
            selectedDate={selectedDate}
            loading={calendarLoading}
            initialIndex={mainCalendarInitialIndex}
            extraDataToken={calendarExtraDataToken}
            scrollToDate={calendarScrollRequest?.date ?? null}
            scrollToDateAnimated={calendarScrollRequest?.animated ?? true}
            onScrollToDateHandled={handleCalendarScrollHandled}
            onDayPress={handleDayPress}
            onVisibleDayChange={handleCalendarVisibleDayChange}
          />

          <NutritionObjectiveCard stats={nutritionStats} />

          <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.duration(400).delay(300)}
            style={styles.mealsSection}
          >
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
            intakes={todayWater?.intakes || []}
            onRemoveWater={handleRemoveWater}
          />
        </ScrollView>

        {showCalendarLogModal && (
          <NutritionCalendarLogModal
            visible={showCalendarLogModal}
            calendarDays={calendarDays}
            daysData={daysData}
            selectedDate={selectedDate}
            maxSelectableDate={maxPlannableDate}
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
  calendarMonthTitle: {
    marginBottom: spacingY._10,
    paddingHorizontal: spacingX._5,
  },
  mealsSection: {
    marginBottom: spacingY._30,
    gap: spacingY._15,
  },
});
