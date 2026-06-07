import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import SwipeableScreen from "@/src/components/layout/SwipeableScreen";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useLanguage } from "@/src/contexts/languageContext";
import { LOCALE_BY_LANGUAGE } from "@/src/i18n/translations";
import { getUserNutritionHistory } from "@/src/services/nutritionService";
import { getUserWaterHistory } from "@/src/services/waterService";
import { getCachedWorkoutHistory } from "@/src/services/workoutHistoryCacheService";
import { getUserWorkouts } from "@/src/services/workoutService";
import { DailyNutrition, DailyWater, WorkoutHistory } from "@/src/types/index";
import { measureAsync } from "@/src/utils/perf";
import { scale, verticalScale } from "@/src/utils/styling";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";

type PeriodType = "Weekly" | "Monthly" | "Yearly";

type ChartDataPoint = {
  value: number;
  label: string;
  dataPointText?: string;
};

type ExerciseStats = {
  exerciseName: string;
  totalWeight: number;
  maxWeight: number;
  totalReps: number;
  averageTopSetReps: number;
  workoutCount: number;
  dates: Date[];
  weights: number[];
  reps: number[];
};

type StatisticsTab = "workouts" | "nutrition";

type NutritionDayStats = {
  date: Date;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
};

const getPeriodStartDate = (period: PeriodType): Date => {
  const periodStart = new Date();
  periodStart.setHours(0, 0, 0, 0);

  if (period === "Weekly") {
    periodStart.setDate(periodStart.getDate() - 7);
  } else if (period === "Monthly") {
    periodStart.setMonth(periodStart.getMonth() - 1);
  } else {
    periodStart.setFullYear(periodStart.getFullYear() - 1);
  }

  return periodStart;
};

const Statistics = React.memo(() => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("Monthly");
  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const [availableExercises, setAvailableExercises] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [exerciseStats, setExerciseStats] = useState<ExerciseStats | null>(
    null
  );
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);

  const [weightChartData, setWeightChartData] = useState<ChartDataPoint[]>([]);
  const [repsChartData, setRepsChartData] = useState<ChartDataPoint[]>([]);
  const [chartWidth, setChartWidth] = useState(scale(320));
  const requestIdRef = useRef(0);
  const previousUserIdRef = useRef<string | null>(null);

  // Nutrition / Water tab state
  const [activeTab, setActiveTab] = useState<StatisticsTab>("workouts");
  const [nutritionHistory, setNutritionHistory] = useState<DailyNutrition[]>([]);
  const [waterHistory, setWaterHistory] = useState<DailyWater[]>([]);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const nutritionRequestIdRef = useRef(0);

  const calculateChartSpacing = useCallback(
    (pointCount: number) => {
      if (pointCount <= 1) return scale(50);

      const usableWidth = Math.max(chartWidth - scale(60), scale(180));
      const dynamicSpacing = usableWidth / (pointCount - 1);

      return Math.max(scale(26), Math.min(scale(50), dynamicSpacing));
    },
    [chartWidth]
  );

  const handleChartLayout = useCallback((event: LayoutChangeEvent) => {
    const containerWidth = event.nativeEvent.layout.width;
    const nextChartWidth = Math.max(
      scale(220),
      containerWidth - spacingX._20 * 2
    );

    setChartWidth((previousWidth) =>
      Math.abs(previousWidth - nextChartWidth) > 1
        ? nextChartWidth
        : previousWidth
    );
  }, []);

  useEffect(() => {
    extractExercises();
  }, [workoutsHistory, selectedPeriod]);

  useEffect(() => {
    if (selectedExercise && workoutsHistory.length > 0) {
      generateExerciseStats();
      return;
    }

    setExerciseStats(null);
    setWeightChartData([]);
    setRepsChartData([]);
  }, [language, selectedExercise, selectedPeriod, workoutsHistory]);

  const fetchWorkoutsHistory = useCallback(async () => {
    const userId = user?.uid;
    const requestId = ++requestIdRef.current;
    if (!userId) {
      setWorkoutsHistory([]);
      setLoading(false);
      return;
    }

    if (previousUserIdRef.current !== userId) {
      setWorkoutsHistory([]);
      setLoading(true);
    }
    previousUserIdRef.current = userId;

    let hydratedFromCache = false;

    const cacheResult = await measureAsync(
      "statistics_hydrate_cache_ms",
      () => getCachedWorkoutHistory(userId, { allowStale: true }),
      (result) => ({
        source: result.data ? "cache" : "fallback",
        itemCount: result.data?.length ?? 0,
        cacheAgeMs: result.ageMs ?? null,
        success: Boolean(result.data),
      }),
    );

    if (requestId !== requestIdRef.current) return;

    if (cacheResult.data) {
      hydratedFromCache = true;
      setWorkoutsHistory(cacheResult.data);
      setLoading(false);
    }

    try {
      const result = await measureAsync(
        "statistics_revalidate_remote_ms",
        () => getUserWorkouts(userId),
        (remoteResult) => ({
          source: remoteResult.success ? "remote" : "fallback",
          itemCount: Array.isArray(remoteResult.data) ? remoteResult.data.length : 0,
          cacheAgeMs: null,
          success: remoteResult.success,
        }),
      );
      if (requestId !== requestIdRef.current) return;

      if (result.success) {
        setWorkoutsHistory(result.data || []);
      } else if (!hydratedFromCache) {
        setWorkoutsHistory([]);
      }
    } catch (error) {
      if (__DEV__) {
        console.error("Error fetching workouts:", error);
      }
      if (!hydratedFromCache && requestId === requestIdRef.current) {
        setWorkoutsHistory([]);
      }
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void fetchWorkoutsHistory();
    return () => {
      requestIdRef.current += 1;
    };
  }, [fetchWorkoutsHistory]);

  const getFilteredWorkouts = (period: PeriodType): WorkoutHistory[] => {
    const periodStart = getPeriodStartDate(period);

    return workoutsHistory.filter(
      (workout) => !workout.isRestDay && new Date(workout.date) >= periodStart
    );
  };

  const extractExercises = () => {
    const exerciseSet = new Set<string>();
    const sourceWorkouts =
      selectedPeriod === "Weekly"
        ? getFilteredWorkouts("Weekly")
        : workoutsHistory.filter((workout) => !workout.isRestDay);

    sourceWorkouts.forEach((workout) => {
      workout.exercises?.forEach((exercise) => {
        if (exercise.exerciseName) {
          exerciseSet.add(exercise.exerciseName);
        }
      });
    });

    const exercises = Array.from(exerciseSet).sort();
    setAvailableExercises(exercises);

    if (exercises.length === 0) {
      setSelectedExercise("");
      setShowExerciseSelector(false);
      return;
    }

    const selectedExerciseExists = exercises.some(
      (exerciseName) =>
        exerciseName.toLowerCase() === selectedExercise.toLowerCase()
    );

    if (!selectedExerciseExists) {
      setSelectedExercise(exercises[0]);
    }
  };

  const generateExerciseStats = () => {
    if (!selectedExercise) return;
    const filteredWorkouts = getFilteredWorkouts(selectedPeriod);

    filteredWorkouts.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const dates: Date[] = [];
    const weights: number[] = [];
    const reps: number[] = [];
    let totalWeight = 0;
    let maxWeight = 0;
    let totalReps = 0;
    let totalTopSetReps = 0;
    let workoutCount = 0;

    filteredWorkouts.forEach((workout) => {
      const exercise = workout.exercises?.find(
        (ex) => ex.exerciseName.toLowerCase() === selectedExercise.toLowerCase()
      );

      if (exercise) {
        workoutCount++;
        const workoutDate = new Date(workout.date);

        let maxWeightThisWorkout = 0;
        let repsAtMaxWeightThisWorkout = 0;
        let totalWeightThisWorkout = 0;

        exercise.sets.forEach((set) => {
          const weight =
            set.weightUnit === "lbs" ? set.weight * 0.453592 : set.weight;

          if (weight > maxWeightThisWorkout) {
            maxWeightThisWorkout = weight;
            repsAtMaxWeightThisWorkout = set.reps;
          } else if (
            weight === maxWeightThisWorkout &&
            set.reps > repsAtMaxWeightThisWorkout
          ) {
            repsAtMaxWeightThisWorkout = set.reps;
          }

          totalWeightThisWorkout += weight * set.reps;
          totalReps += set.reps;
        });

        dates.push(workoutDate);
        weights.push(Math.round(maxWeightThisWorkout * 10) / 10);
        reps.push(repsAtMaxWeightThisWorkout);
        totalWeight += totalWeightThisWorkout;
        totalTopSetReps += repsAtMaxWeightThisWorkout;

        if (maxWeightThisWorkout > maxWeight) {
          maxWeight = maxWeightThisWorkout;
        }
      }
    });

    setExerciseStats({
      exerciseName: selectedExercise,
      totalWeight: Math.round(totalWeight),
      maxWeight: Math.round(maxWeight * 10) / 10,
      totalReps,
      averageTopSetReps:
        workoutCount > 0 ? Math.round(totalTopSetReps / workoutCount) : 0,
      workoutCount,
      dates,
      weights,
      reps,
    });

    generateChartData(dates, weights, reps);
  };

  const generateChartData = (
    dates: Date[],
    weights: number[],
    reps: number[]
  ) => {
    const weightData: ChartDataPoint[] = [];
    const repsData: ChartDataPoint[] = [];

    dates.forEach((date, index) => {
      const label = date.toLocaleDateString(LOCALE_BY_LANGUAGE[language], {
        month: "short",
        day: "numeric",
      });

      weightData.push({
        value: weights[index],
        label: label,
        dataPointText: `${weights[index]}kg`,
      });

      repsData.push({
        value: reps[index],
        label: label,
        dataPointText: `${reps[index]}`,
      });
    });

    setWeightChartData(weightData);
    setRepsChartData(repsData);
  };

  const handleSegmentChange = (index: number) => {
    const periods: PeriodType[] = ["Weekly", "Monthly", "Yearly"];
    setSelectedPeriod(periods[index]);
  };

  const getTotalWorkouts = () => {
    return getFilteredWorkouts(selectedPeriod).length;
  };

  const getTotalTime = () => {
    return getFilteredWorkouts(selectedPeriod).reduce(
      (sum, workout) => sum + Math.floor(workout.duration / 60),
      0,
    );
  };

  const hasAnyWorkoutHistory = workoutsHistory.some(
    (workout) => !workout.isRestDay
  );

  // Nutrition / Water data fetching
  const fetchNutritionAndWater = useCallback(async () => {
    const userId = user?.uid;
    const requestId = ++nutritionRequestIdRef.current;
    if (!userId) {
      setNutritionHistory([]);
      setWaterHistory([]);
      setNutritionLoading(false);
      return;
    }

    setNutritionLoading(true);
    try {
      const [nutritionResult, waterResult] = await Promise.all([
        getUserNutritionHistory(userId),
        getUserWaterHistory(userId),
      ]);
      if (requestId !== nutritionRequestIdRef.current) return;

      if (nutritionResult.success && Array.isArray(nutritionResult.data)) {
        setNutritionHistory(nutritionResult.data);
      }
      if (waterResult.success && Array.isArray(waterResult.data)) {
        setWaterHistory(waterResult.data);
      }
    } catch (error) {
      if (__DEV__) {
        console.error("Error fetching nutrition/water history:", error);
      }
    } finally {
      if (requestId === nutritionRequestIdRef.current) {
        setNutritionLoading(false);
      }
    }
  }, [user?.uid]);

  useEffect(() => {
    if (activeTab === "nutrition") {
      void fetchNutritionAndWater();
    }
    return () => {
      nutritionRequestIdRef.current += 1;
    };
  }, [activeTab, fetchNutritionAndWater]);

  // Nutrition / Water data processing
  const nutritionDayStats = useMemo((): NutritionDayStats[] => {
    const periodStart = getPeriodStartDate(selectedPeriod);

    // Build a map of date -> nutrition totals
    const dayMap = new Map<string, NutritionDayStats>();

    for (const day of nutritionHistory) {
      const dayDate = new Date(day.date);
      dayDate.setHours(0, 0, 0, 0);
      if (dayDate < periodStart) continue;

      const key = dayDate.toISOString();
      const meals = Array.isArray(day.meals) ? day.meals : [];

      let calories = 0;
      let protein = 0;
      let carbs = 0;
      let fat = 0;
      for (const meal of meals) {
        const foods = Array.isArray(meal.foods) ? meal.foods : [];
        for (const food of foods) {
          calories += Number(food.calories) || 0;
          protein += Number(food.protein) || 0;
          carbs += Number(food.carbs) || 0;
          fat += Number(food.fat) || 0;
        }
      }

      if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) continue;

      dayMap.set(key, {
        date: dayDate,
        calories,
        protein,
        carbs,
        fat,
        water: 0,
      });
    }

    // Merge water data
    for (const day of waterHistory) {
      const dayDate = new Date(day.date);
      dayDate.setHours(0, 0, 0, 0);
      if (dayDate < periodStart) continue;

      const key = dayDate.toISOString();
      const existing = dayMap.get(key);
      if (existing) {
        existing.water = day.total || 0;
      } else if ((day.total || 0) > 0) {
        dayMap.set(key, {
          date: dayDate,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          water: day.total || 0,
        });
      }
    }

    return Array.from(dayMap.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }, [nutritionHistory, waterHistory, selectedPeriod]);

  const nutritionAverages = useMemo(() => {
    if (nutritionDayStats.length === 0) {
      return { avgCalories: 0, avgProtein: 0, avgWater: 0 };
    }

    const daysWithCalories = nutritionDayStats.filter((d) => d.calories > 0);
    const daysWithWater = nutritionDayStats.filter((d) => d.water > 0);

    const totalCalories = daysWithCalories.reduce((s, d) => s + d.calories, 0);
    const totalProtein = daysWithCalories.reduce((s, d) => s + d.protein, 0);
    const totalWater = daysWithWater.reduce((s, d) => s + d.water, 0);

    return {
      avgCalories: daysWithCalories.length > 0
        ? Math.round(totalCalories / daysWithCalories.length)
        : 0,
      avgProtein: daysWithCalories.length > 0
        ? Math.round(totalProtein / daysWithCalories.length)
        : 0,
      avgWater: daysWithWater.length > 0
        ? Math.round(totalWater / daysWithWater.length)
        : 0,
    };
  }, [nutritionDayStats]);

  const calorieChartData = useMemo((): ChartDataPoint[] => {
    return nutritionDayStats
      .filter((d) => d.calories > 0)
      .map((d) => ({
        value: d.calories,
        label: d.date.toLocaleDateString(LOCALE_BY_LANGUAGE[language], {
          month: "short",
          day: "numeric",
        }),
        dataPointText: `${d.calories}`,
      }));
  }, [nutritionDayStats, language]);

  const waterChartData = useMemo((): ChartDataPoint[] => {
    return nutritionDayStats
      .filter((d) => d.water > 0)
      .map((d) => ({
        value: d.water,
        label: d.date.toLocaleDateString(LOCALE_BY_LANGUAGE[language], {
          month: "short",
          day: "numeric",
        }),
        dataPointText: `${d.water}`,
      }));
  }, [nutritionDayStats, language]);

  const hasAnyNutritionHistory =
    nutritionHistory.length > 0 || waterHistory.length > 0;

  return (
    <SwipeableScreen>
    <ScreenWrapper>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Typo size={32} variant="heading">
            {t("tab_statistics")}
          </Typo>
        </View>

        {/* Tab toggle: Workouts / Nutrition */}
        <View style={styles.tabToggleContainer}>
          <View style={styles.stackedOuter}>
            <View style={styles.shadowRounded17} />
            <View style={styles.tabToggleCard}>
              <SegmentedControl
                values={[
                  t("statistics_tab_workouts"),
                  t("statistics_tab_nutrition"),
                ]}
                selectedIndex={activeTab === "workouts" ? 0 : 1}
                onChange={(event) =>
                  setActiveTab(
                    event.nativeEvent.selectedSegmentIndex === 0
                      ? "workouts"
                      : "nutrition"
                  )
                }
                style={styles.segmentedControl}
                backgroundColor={colors.neutral800}
                tintColor={colors.primary}
                fontStyle={{
                  color: colors.neutral400,
                  fontSize: verticalScale(14),
                  fontWeight: "600",
                }}
                activeFontStyle={{
                  color: colors.black,
                  fontSize: verticalScale(14),
                  fontWeight: "700",
                }}
              />
            </View>
          </View>
        </View>

        {/* ============== WORKOUTS TAB ============== */}
        {activeTab === "workouts" && (
          <>
            {loading && workoutsHistory.length === 0 ? (
              <View style={styles.initialLoadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}

            <View style={styles.segmentedContainer}>
              <View style={styles.stackedOuter}>
                <View style={styles.shadowRounded17} />
                <View style={styles.segmentedCard}>
                  <SegmentedControl
                    values={[
                      t("statistics_period_weekly"),
                      t("statistics_period_monthly"),
                      t("statistics_period_yearly"),
                    ]}
                    selectedIndex={
                      selectedPeriod === "Weekly"
                        ? 0
                        : selectedPeriod === "Monthly"
                        ? 1
                        : 2
                    }
                    onChange={(event) =>
                      handleSegmentChange(event.nativeEvent.selectedSegmentIndex)
                    }
                    style={styles.segmentedControl}
                    backgroundColor={colors.neutral800}
                    tintColor={colors.primary}
                    fontStyle={{
                      color: colors.neutral400,
                      fontSize: verticalScale(14),
                      fontWeight: "600",
                    }}
                    activeFontStyle={{
                      color: colors.black,
                      fontSize: verticalScale(14),
                      fontWeight: "700",
                    }}
                  />
                </View>
              </View>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.stackedOuterFlex}>
                <View style={styles.shadowRounded17} />
                <View style={styles.statCard}>
                  <Icons.BarbellIcon size={24} color={colors.primary} weight="fill" />
                  <Typo size={40} variant="metric" color={colors.primary} style={{ marginTop: spacingY._7 }}>
                    {getTotalWorkouts()}
                  </Typo>
                  <Typo size={13} color={colors.neutral400}>
                    {t("statistics_workouts")}
                  </Typo>
                </View>
              </View>

              <View style={styles.stackedOuterFlex}>
                <View style={styles.shadowRounded17} />
                <View style={styles.statCard}>
                  <Icons.TimerIcon size={24} color={colors.green} weight="fill" />
                  <Typo size={40} variant="metric" color={colors.chartSuccess} style={{ marginTop: spacingY._7 }}>
                    {getTotalTime()}
                  </Typo>
                  <Typo size={13} color={colors.neutral400}>
                    {t("statistics_minutes")}
                  </Typo>
                </View>
              </View>
            </View>

            {availableExercises.length > 0 && (
              <View style={styles.exerciseSelectorContainer}>
                <View style={styles.stackedOuter}>
                  <View style={styles.shadowRounded15} />
                  <TouchableOpacity
                    style={styles.exerciseSelectorButton}
                    onPress={() => setShowExerciseSelector(!showExerciseSelector)}
                  >
                    <View style={styles.exerciseSelectorLeft}>
                      <Icons.ChartLineIcon
                        size={20}
                        color={colors.primary}
                        weight="fill"
                      />
                      <Typo size={16} fontWeight="600" color={colors.white}>
                        {selectedExercise || t("statistics_select_exercise")}
                      </Typo>
                    </View>
                    <Icons.CaretDownIcon
                      size={20}
                      color={colors.neutral400}
                      style={{
                        transform: [
                          { rotate: showExerciseSelector ? "180deg" : "0deg" },
                        ],
                      }}
                    />
                  </TouchableOpacity>
                </View>

                {showExerciseSelector && (
                  <View style={styles.stackedOuterDropdown}>
                    <View style={styles.shadowRounded15} />
                    <View style={styles.exerciseDropdown}>
                      <ScrollView
                        style={styles.exerciseList}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                      >
                        {availableExercises.map((exercise, index) => (
                          <TouchableOpacity
                            key={`${exercise}-${index}`}
                            style={[
                              styles.exerciseItem,
                              selectedExercise === exercise &&
                                styles.exerciseItemSelected,
                            ]}
                            onPress={() => {
                              setSelectedExercise(exercise);
                              setShowExerciseSelector(false);
                            }}
                          >
                            <Typo
                              size={15}
                              fontWeight={
                                selectedExercise === exercise ? "600" : "400"
                              }
                              color={
                                selectedExercise === exercise
                                  ? colors.primary
                                  : colors.white
                              }
                            >
                              {exercise}
                            </Typo>
                            {selectedExercise === exercise && (
                              <Icons.CheckIcon
                                size={18}
                                color={colors.primary}
                                weight="bold"
                              />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                )}
              </View>
            )}

            {exerciseStats && exerciseStats.workoutCount > 0 && (
              <>
                <View style={styles.exerciseStatsContainer}>
                  <View style={styles.stackedOuterFlex}>
                    <View style={styles.shadowRounded15} />
                    <View style={styles.exerciseStatCard}>
                      <Icons.TrendUpIcon
                        size={24}
                        color={colors.primary}
                        weight="fill"
                      />
                      <Typo size={32} variant="metric" color={colors.primary} style={{ marginTop: spacingY._7 }}>
                        {exerciseStats.maxWeight} kg
                      </Typo>
                      <Typo size={13} color={colors.neutral400}>
                        {t("statistics_max_weight")}
                      </Typo>
                    </View>
                  </View>

                  <View style={styles.stackedOuterFlex}>
                    <View style={styles.shadowRounded15} />
                    <View style={styles.exerciseStatCard}>
                      <Icons.HashIcon size={24} color={colors.green} weight="fill" />
                      <Typo size={32} variant="metric" color={colors.chartSuccess} style={{ marginTop: spacingY._7 }}>
                        {exerciseStats.totalReps}
                      </Typo>
                      <Typo size={13} color={colors.neutral400}>
                        {t("statistics_total_reps")}
                      </Typo>
                    </View>
                  </View>

                  <View style={styles.stackedOuterFlex}>
                    <View style={styles.shadowRounded15} />
                    <View style={styles.exerciseStatCard}>
                      <Icons.ScalesIcon size={24} color={colors.accent} weight="fill" />
                      <Typo size={32} variant="metric" color={colors.accent} style={{ marginTop: spacingY._7 }}>
                        {exerciseStats.totalWeight}
                      </Typo>
                      <Typo size={13} color={colors.neutral400}>
                        {t("statistics_total_kg")}
                      </Typo>
                    </View>
                  </View>
                </View>

                {weightChartData.length > 0 && (
                  <View style={styles.stackedOuterWithGap}>
                    <View style={styles.shadowRounded17} />
                    <View style={styles.chartContainer} onLayout={handleChartLayout}>
                      <View style={styles.chartHeader}>
                        <Typo size={18} fontWeight="600" style={styles.chartTitle}>
                          {t("statistics_weight_progress")}
                        </Typo>
                        <View style={styles.chartBadge}>
                          <Typo
                            size={13}
                            color={colors.white}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                            style={styles.chartBadgeText}
                          >
                            {t("statistics_sessions_count", {
                              count: exerciseStats.workoutCount,
                            })}
                          </Typo>
                        </View>
                      </View>

                      <LineChart
                        data={weightChartData}
                        width={chartWidth}
                        height={verticalScale(200)}
                        spacing={calculateChartSpacing(weightChartData.length)}
                        thickness={3}
                        color={colors.primary}
                        startFillColor={colors.primary}
                        endFillColor={colors.primary}
                        startOpacity={0.3}
                        endOpacity={0.1}
                        adjustToWidth
                        initialSpacing={scale(14)}
                        endSpacing={scale(14)}
                        noOfSections={4}
                        yAxisTextStyle={{
                          color: colors.neutral400,
                          fontSize: verticalScale(12),
                        }}
                        xAxisLabelTextStyle={{
                          color: colors.neutral400,
                          fontSize: verticalScale(11),
                        }}
                        hideRules
                        curved
                        areaChart
                        hideDataPoints={false}
                        dataPointsColor={colors.primary}
                        dataPointsRadius={4}
                        textShiftY={-8}
                        textShiftX={-5}
                        textFontSize={11}
                        textColor={colors.white}
                      />
                    </View>
                  </View>
                )}

                {repsChartData.length > 0 && (
                  <View style={styles.stackedOuterWithGap}>
                    <View style={styles.shadowRounded17} />
                    <View style={styles.chartContainer} onLayout={handleChartLayout}>
                      <View style={styles.chartHeader}>
                        <Typo size={18} fontWeight="600" style={styles.chartTitle}>
                          {t("statistics_reps_progress")}
                        </Typo>
                        <View style={styles.chartBadge}>
                          <Typo
                            size={13}
                            color={colors.white}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                            style={styles.chartBadgeText}
                          >
                            {t("statistics_avg_max_kg_reps", {
                              count: exerciseStats.averageTopSetReps,
                            })}
                          </Typo>
                        </View>
                      </View>

                      <LineChart
                        data={repsChartData}
                        width={chartWidth}
                        height={verticalScale(200)}
                        spacing={calculateChartSpacing(repsChartData.length)}
                        thickness={3}
                        color={colors.green}
                        startFillColor={colors.green}
                        endFillColor={colors.green}
                        startOpacity={0.3}
                        endOpacity={0.1}
                        adjustToWidth
                        initialSpacing={scale(14)}
                        endSpacing={scale(14)}
                        noOfSections={4}
                        yAxisTextStyle={{
                          color: colors.neutral400,
                          fontSize: verticalScale(12),
                        }}
                        xAxisLabelTextStyle={{
                          color: colors.neutral400,
                          fontSize: verticalScale(11),
                        }}
                        hideRules
                        curved
                        areaChart
                        hideDataPoints={false}
                        dataPointsColor={colors.green}
                        dataPointsRadius={4}
                        textShiftY={-8}
                        textShiftX={-5}
                        textFontSize={11}
                        textColor={colors.white}
                      />
                    </View>
                  </View>
                )}
              </>
            )}

            {exerciseStats && exerciseStats.workoutCount === 0 && (
              <View style={styles.emptyState}>
                <Icons.ChartLineIcon
                  size={48}
                  color={colors.neutral500}
                  weight="fill"
                />
                <Typo
                  size={18}
                  fontWeight="600"
                  color={colors.neutral200}
                  style={{ marginTop: spacingY._15 }}
                >
                  {t("statistics_no_data_period")}
                </Typo>
                <Typo
                  size={14}
                  color={colors.neutral400}
                  style={{ marginTop: spacingY._7, textAlign: "center" }}
                >
                  {t("statistics_train_exercise", { exercise: selectedExercise })}
                </Typo>
              </View>
            )}

            {availableExercises.length === 0 && (
              <View style={styles.emptyState}>
                <Icons.BarbellIcon
                  size={48}
                  color={colors.neutral500}
                  weight="fill"
                />
                <Typo
                  size={18}
                  fontWeight="600"
                  color={colors.neutral200}
                  style={{ marginTop: spacingY._15 }}
                >
                  {selectedPeriod === "Weekly" && hasAnyWorkoutHistory
                    ? t("statistics_no_workouts_this_week")
                    : t("statistics_no_workouts_yet")}
                </Typo>
                <Typo
                  size={14}
                  color={colors.neutral400}
                  style={{ marginTop: spacingY._7, textAlign: "center" }}
                >
                  {selectedPeriod === "Weekly" && hasAnyWorkoutHistory
                    ? t("statistics_log_weekly")
                    : t("statistics_start_training")}
                </Typo>
              </View>
            )}
          </>
        )}

        {/* ============== NUTRITION TAB ============== */}
        {activeTab === "nutrition" && (
          <>
            {nutritionLoading && nutritionDayStats.length === 0 ? (
              <View style={styles.initialLoadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}

            {/* Period selector (shared style with workouts) */}
            <View style={styles.segmentedContainer}>
              <View style={styles.stackedOuter}>
                <View style={styles.shadowRounded17} />
                <View style={styles.segmentedCard}>
                  <SegmentedControl
                    values={[
                      t("statistics_period_weekly"),
                      t("statistics_period_monthly"),
                      t("statistics_period_yearly"),
                    ]}
                    selectedIndex={
                      selectedPeriod === "Weekly"
                        ? 0
                        : selectedPeriod === "Monthly"
                        ? 1
                        : 2
                    }
                    onChange={(event) =>
                      handleSegmentChange(event.nativeEvent.selectedSegmentIndex)
                    }
                    style={styles.segmentedControl}
                    backgroundColor={colors.neutral800}
                    tintColor={colors.primary}
                    fontStyle={{
                      color: colors.neutral400,
                      fontSize: verticalScale(14),
                      fontWeight: "600",
                    }}
                    activeFontStyle={{
                      color: colors.black,
                      fontSize: verticalScale(14),
                      fontWeight: "700",
                    }}
                  />
                </View>
              </View>
            </View>

            {/* Average stats cards */}
            {nutritionDayStats.length > 0 && (
              <>
                <View style={styles.statsContainer}>
                  <View style={styles.stackedOuterFlex}>
                    <View style={styles.shadowRounded17} />
                    <View style={styles.statCard}>
                      <Icons.FireIcon size={24} color={colors.chartWarning} weight="fill" />
                      <Typo size={32} variant="metric" color={colors.chartWarning} style={{ marginTop: spacingY._7 }}>
                        {nutritionAverages.avgCalories}
                      </Typo>
                      <Typo size={13} color={colors.neutral400}>
                        {t("statistics_average_calories")}
                      </Typo>
                    </View>
                  </View>

                  <View style={styles.stackedOuterFlex}>
                    <View style={styles.shadowRounded17} />
                    <View style={styles.statCard}>
                      <Icons.EggIcon size={24} color={colors.macroProtein} weight="fill" />
                      <Typo size={32} variant="metric" color={colors.macroProtein} style={{ marginTop: spacingY._7 }}>
                        {nutritionAverages.avgProtein}g
                      </Typo>
                      <Typo size={13} color={colors.neutral400}>
                        {t("statistics_average_protein")}
                      </Typo>
                    </View>
                  </View>

                  <View style={styles.stackedOuterFlex}>
                    <View style={styles.shadowRounded17} />
                    <View style={styles.statCard}>
                      <Icons.DropIcon size={24} color={colors.waterAccent} weight="fill" />
                      <Typo size={32} variant="metric" color={colors.waterAccent} style={{ marginTop: spacingY._7 }}>
                        {nutritionAverages.avgWater}
                      </Typo>
                      <Typo size={13} color={colors.neutral400}>
                        {t("statistics_average_water")}
                      </Typo>
                    </View>
                  </View>
                </View>

                {/* Calorie trend chart */}
                {calorieChartData.length > 0 && (
                  <View style={styles.stackedOuterWithGap}>
                    <View style={styles.shadowRounded17} />
                    <View style={styles.chartContainer} onLayout={handleChartLayout}>
                      <View style={styles.chartHeader}>
                        <Typo size={18} fontWeight="600" style={styles.chartTitle}>
                          {t("statistics_calories_chart_title")}
                        </Typo>
                        <View style={styles.chartBadge}>
                          <Typo
                            size={13}
                            color={colors.white}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                            style={styles.chartBadgeText}
                          >
                            {t("statistics_kcal")}
                          </Typo>
                        </View>
                      </View>

                      <LineChart
                        data={calorieChartData}
                        width={chartWidth}
                        height={verticalScale(200)}
                        spacing={calculateChartSpacing(calorieChartData.length)}
                        thickness={3}
                        color={colors.chartWarning}
                        startFillColor={colors.chartWarning}
                        endFillColor={colors.chartWarning}
                        startOpacity={0.3}
                        endOpacity={0.1}
                        adjustToWidth
                        initialSpacing={scale(14)}
                        endSpacing={scale(14)}
                        noOfSections={4}
                        yAxisTextStyle={{
                          color: colors.neutral400,
                          fontSize: verticalScale(12),
                        }}
                        xAxisLabelTextStyle={{
                          color: colors.neutral400,
                          fontSize: verticalScale(11),
                        }}
                        hideRules
                        curved
                        areaChart
                        hideDataPoints={false}
                        dataPointsColor={colors.chartWarning}
                        dataPointsRadius={4}
                        textShiftY={-8}
                        textShiftX={-5}
                        textFontSize={11}
                        textColor={colors.white}
                      />
                    </View>
                  </View>
                )}

                {/* Water trend chart */}
                {waterChartData.length > 0 && (
                  <View style={styles.stackedOuterWithGap}>
                    <View style={styles.shadowRounded17} />
                    <View style={styles.chartContainer} onLayout={handleChartLayout}>
                      <View style={styles.chartHeader}>
                        <Typo size={18} fontWeight="600" style={styles.chartTitle}>
                          {t("statistics_water_chart_title")}
                        </Typo>
                        <View style={styles.chartBadge}>
                          <Typo
                            size={13}
                            color={colors.white}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                            style={styles.chartBadgeText}
                          >
                            {t("statistics_ml")}
                          </Typo>
                        </View>
                      </View>

                      <LineChart
                        data={waterChartData}
                        width={chartWidth}
                        height={verticalScale(200)}
                        spacing={calculateChartSpacing(waterChartData.length)}
                        thickness={3}
                        color={colors.waterAccent}
                        startFillColor={colors.waterAccent}
                        endFillColor={colors.waterAccent}
                        startOpacity={0.3}
                        endOpacity={0.1}
                        adjustToWidth
                        initialSpacing={scale(14)}
                        endSpacing={scale(14)}
                        noOfSections={4}
                        yAxisTextStyle={{
                          color: colors.neutral400,
                          fontSize: verticalScale(12),
                        }}
                        xAxisLabelTextStyle={{
                          color: colors.neutral400,
                          fontSize: verticalScale(11),
                        }}
                        hideRules
                        curved
                        areaChart
                        hideDataPoints={false}
                        dataPointsColor={colors.waterAccent}
                        dataPointsRadius={4}
                        textShiftY={-8}
                        textShiftX={-5}
                        textFontSize={11}
                        textColor={colors.white}
                      />
                    </View>
                  </View>
                )}
              </>
            )}

            {/* Nutrition empty state */}
            {!nutritionLoading && nutritionDayStats.length === 0 && (
              <View style={styles.emptyState}>
                <Icons.ForkKnifeIcon
                  size={48}
                  color={colors.neutral500}
                  weight="fill"
                />
                <Typo
                  size={18}
                  fontWeight="600"
                  color={colors.neutral200}
                  style={{ marginTop: spacingY._15 }}
                >
                  {selectedPeriod === "Weekly" && hasAnyNutritionHistory
                    ? t("statistics_no_nutrition_this_week")
                    : t("statistics_no_nutrition_yet")}
                </Typo>
                <Typo
                  size={14}
                  color={colors.neutral400}
                  style={{ marginTop: spacingY._7, textAlign: "center" }}
                >
                  {selectedPeriod === "Weekly" && hasAnyNutritionHistory
                    ? t("statistics_log_nutrition_weekly")
                    : t("statistics_start_logging_nutrition")}
                </Typo>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
    </SwipeableScreen>
  );
});

Statistics.displayName = "Statistics";

export default Statistics;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  header: {
    paddingVertical: spacingY._15,
    alignItems: "center",
  },
  initialLoadingContainer: {
    marginBottom: spacingY._12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: verticalScale(28),
  },
  tabToggleContainer: {
    marginBottom: spacingY._15,
  },
  tabToggleCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    borderWidth: 2,
    borderColor: colors.neutral700,
    padding: spacingX._7,
  },
  segmentedContainer: {
    marginBottom: spacingY._20,
  },
  stackedOuter: {
    position: "relative",
    marginRight: 6,
  },
  stackedOuterWithGap: {
    position: "relative",
    marginRight: 6,
    marginBottom: spacingY._20,
  },
  stackedOuterDropdown: {
    position: "relative",
    marginTop: spacingY._10,
    marginRight: 6,
  },
  stackedOuterFlex: {
    position: "relative",
    flex: 1,
    marginBottom: 6,
  },
  shadowRounded17: {
    position: "absolute",
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.cardShadow,
    borderRadius: radius._17,
  },
  shadowRounded15: {
    position: "absolute",
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.cardShadow,
    borderRadius: radius._15,
  },
  segmentedCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    borderWidth: 2,
    borderColor: colors.neutral700,
    padding: spacingX._7,
  },
  segmentedControl: {
    height: verticalScale(45),
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacingY._20,
    gap: spacingX._10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._15,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.neutral700,
  },
  exerciseSelectorContainer: {
    marginBottom: spacingY._20,
  },
  exerciseSelectorButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    padding: spacingX._15,
    borderWidth: 2,
    borderColor: colors.neutral700,
  },
  exerciseSelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  exerciseDropdown: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderWidth: 2,
    borderColor: colors.neutral700,
    maxHeight: verticalScale(300),
    overflow: "hidden",
  },
  exerciseList: {
    maxHeight: verticalScale(300),
    padding: spacingX._10,
  },
  exerciseItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._15,
    borderRadius: radius._12,
  },
  exerciseItemSelected: {
    backgroundColor: colors.neutral700,
  },
  exerciseStatsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacingY._20,
    gap: spacingX._7,
  },
  exerciseStatCard: {
    flex: 1,
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    padding: spacingX._12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.neutral700,
  },
  chartContainer: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    borderWidth: 2,
    borderColor: colors.neutral700,
    overflow: "hidden",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    rowGap: spacingY._7,
    columnGap: spacingX._10,
    marginBottom: spacingY._15,
  },
  chartTitle: {
    flexShrink: 1,
  },
  chartBadge: {
    backgroundColor: colors.neutral700,
    paddingHorizontal: spacingX._12,
    paddingVertical: verticalScale(4),
    borderRadius: radius._10,
    flexShrink: 1,
    maxWidth: "70%",
  },
  chartBadgeText: {
    flexShrink: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacingY._50,
  },
});

