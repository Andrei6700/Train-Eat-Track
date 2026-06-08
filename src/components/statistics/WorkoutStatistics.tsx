import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useLanguage } from "@/src/contexts/languageContext";
import { LOCALE_BY_LANGUAGE } from "@/src/i18n/translations";
import { getCachedWorkoutHistory } from "@/src/services/workoutHistoryCacheService";
import { getUserWorkouts } from "@/src/services/workoutService";
import { WorkoutHistory } from "@/src/types/index";
import { measureAsync } from "@/src/utils/perf";
import { scale, verticalScale } from "@/src/utils/styling";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  PanResponderGestureState,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";

const MemoizedLineChart = React.memo(LineChart);

const ChartSkeleton = ({ color }: { color: string }) => (
  <View style={{ height: verticalScale(200), justifyContent: "center", alignItems: "center" }}>
    <ActivityIndicator size="small" color={color} />
  </View>
);

type PeriodType = "Weekly" | "Monthly" | "Yearly";

type ChartDataPoint = {
  value: number;
  label: string;
  dataPointText?: string;
  textShiftY?: number;
  textFontSize?: number;
  textColor?: string;
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

interface WorkoutStatisticsProps {
  selectedPeriod: PeriodType;
  dataPeriod: PeriodType;
  onPeriodChange: (period: PeriodType) => void;
  active: boolean;
}

const PERIODS: PeriodType[] = ["Weekly", "Monthly", "Yearly"];

const applyLabelFiltering = (points: ChartDataPoint[], suffix: string = ""): ChartDataPoint[] => {
  return points.map((pt, idx) => {
    const shiftY = idx % 2 === 0 ? 12 : -12;

    return {
      ...pt,
      dataPointText: `${pt.value}${suffix}`,
      textShiftY: shiftY,
      textFontSize: 10,
      textColor: "#F5F5F5",
    };
  });
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

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(d.setDate(diff));
};

function WorkoutStatistics({
  selectedPeriod,
  dataPeriod,
  onPeriodChange,
  active,
}: WorkoutStatisticsProps) {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const renderStartTime = Date.now();
  const periodChangeRef = useRef<{ from: PeriodType; to: PeriodType; startTime: number } | null>(null);

  useEffect(() => {
    const renderDuration = Date.now() - renderStartTime;
    if (__DEV__) {
      console.log(`[STATS] WorkoutStatistics - render: ${renderDuration}ms`);
    }
  });

  useEffect(() => {
    if (periodChangeRef.current && periodChangeRef.current.to === dataPeriod) {
      const duration = Date.now() - periodChangeRef.current.startTime;
      if (__DEV__) {
        console.log(`[STATS] Period change ${periodChangeRef.current.from.toLowerCase()}→${periodChangeRef.current.to.toLowerCase()}: ${duration}ms`);
      }
      periodChangeRef.current = null;
    }
  }, [dataPeriod]);

  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);

  const { width } = useWindowDimensions();
  const chartWidth = width - 48;
  const requestIdRef = useRef(0);
  const previousUserIdRef = useRef<string | null>(null);
  const isSwipingRef = useRef(false);
  const swipeStartTimeRef = useRef(0);

  // Swipe left → next period, swipe right → previous period
  const handleSwipePeriod = useCallback(
    (direction: "next" | "prev") => {
      const currentIdx = PERIODS.indexOf(selectedPeriod);
      let nextPeriod: PeriodType | null = null;
      if (direction === "next" && currentIdx < PERIODS.length - 1) {
        nextPeriod = PERIODS[currentIdx + 1];
      } else if (direction === "prev" && currentIdx > 0) {
        nextPeriod = PERIODS[currentIdx - 1];
      }
      if (nextPeriod) {
        periodChangeRef.current = {
          from: selectedPeriod,
          to: nextPeriod,
          startTime: Date.now(),
        };
        onPeriodChange(nextPeriod);
      }
    },
    [selectedPeriod, onPeriodChange]
  );

  const periodPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_: GestureResponderEvent, gs: PanResponderGestureState) => {
        const isHorizontal = Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 20;
        return isHorizontal;
      },
      onPanResponderGrant: () => {
        isSwipingRef.current = false;
        swipeStartTimeRef.current = Date.now();
      },
      onPanResponderMove: (_: GestureResponderEvent, gs: PanResponderGestureState) => {
        if (Math.abs(gs.dx) > 30 && !isSwipingRef.current) {
          isSwipingRef.current = true;
        }
      },
      onPanResponderRelease: (_: GestureResponderEvent, gs: PanResponderGestureState) => {
        const duration = Date.now() - swipeStartTimeRef.current;
        const isQuick = duration < 300 && Math.abs(gs.vx) > 0.3;
        const isLong = Math.abs(gs.dx) > 80;
        if (isQuick || isLong) {
          if (gs.dx < 0) {
            // swipe left → next period
            handleSwipePeriod("next");
          } else {
            // swipe right → previous period
            handleSwipePeriod("prev");
          }
        }
        isSwipingRef.current = false;
      },
      onPanResponderTerminate: () => {
        isSwipingRef.current = false;
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSwipePeriod]);

  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    setChartReady(false);
    const t = setTimeout(() => {
      setChartReady(true);
    }, 50);
    return () => clearTimeout(t);
  }, [dataPeriod]);



  const fetchWorkoutsHistory = useCallback(async () => {
    const userId = user?.uid;
    const requestId = ++requestIdRef.current;
    if (!userId) {
      setWorkoutsHistory([]);
      setLoading(false);
      return;
    }

    const fetchStartTime = Date.now();
    if (__DEV__) {
      console.log(`[STATS] WorkoutStatistics - fetch start: ${new Date().toISOString()}`);
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
      if (requestId === requestIdRef.current) {
        setLoading(false);
        const fetchDuration = Date.now() - fetchStartTime;
        if (__DEV__) {
          console.log(`[STATS] WorkoutStatistics - fetch end: ${new Date().toISOString()}`);
          console.log(`[STATS] WorkoutStatistics - fetch: ${fetchDuration}ms`);
        }
      }
    }
  }, [user?.uid]);

  useEffect(() => {
    void fetchWorkoutsHistory();
    return () => {
      requestIdRef.current += 1;
    };
  }, [fetchWorkoutsHistory]);

  // Memoized: filtered and sorted workouts for current period
  const filteredWorkouts = useMemo(() => {
    const start = Date.now();
    const periodStart = getPeriodStartDate(dataPeriod);
    const result = workoutsHistory
      .filter((workout) => !workout.isRestDay && new Date(workout.date) >= periodStart)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const duration = Date.now() - start;
    if (__DEV__) {
      console.log(`[STATS] WorkoutStatistics - filtered data memo: ${duration}ms`);
    }
    return result;
  }, [workoutsHistory, dataPeriod]);

  // Memoized: overall stats calculations (derive directly from filteredWorkouts)
  const totalWorkoutsCount = useMemo(() => filteredWorkouts.length, [filteredWorkouts]);
  const totalDurationMinutes = useMemo(() => {
    return filteredWorkouts.reduce(
      (sum, workout) => sum + Math.floor(workout.duration / 60),
      0
    );
  }, [filteredWorkouts]);

  // Memoized: available exercises list
  const availableExercises = useMemo(() => {
    const exerciseSet = new Set<string>();
    // For Weekly, only show exercises from that period; otherwise show all time
    const sourceWorkouts =
      dataPeriod === "Weekly"
        ? filteredWorkouts
        : workoutsHistory.filter((w) => !w.isRestDay);

    sourceWorkouts.forEach((workout) => {
      workout.exercises?.forEach((exercise) => {
        if (exercise.exerciseName) {
          exerciseSet.add(exercise.exerciseName);
        }
      });
    });

    return Array.from(exerciseSet).sort();
  }, [workoutsHistory, filteredWorkouts, dataPeriod]);

  // Set default/fallback exercise selection
  useEffect(() => {
    if (availableExercises.length > 0) {
      const selectedExists = availableExercises.some(
        (exerciseName) => exerciseName.toLowerCase() === selectedExercise.toLowerCase()
      );
      if (!selectedExists) {
        setSelectedExercise(availableExercises[0]);
      }
    } else {
      setSelectedExercise("");
    }
  }, [availableExercises, selectedExercise]);

  // Memoized: stats and chart data for selected exercise — downsamples to weekly averages for Yearly
  const exerciseStatsData = useMemo(() => {
    const start = Date.now();
    if (!selectedExercise || filteredWorkouts.length === 0) {
      const result = { exerciseStats: null, weightChartData: [], repsChartData: [] };
      const duration = Date.now() - start;
      if (__DEV__) {
        console.log(`[STATS] WorkoutStatistics - chartData memo: ${duration}ms`);
        console.log(`[STATS] WorkoutStatistics - averages memo: ${duration}ms`);
      }
      return result;
    }

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

    if (workoutCount === 0) {
      const result = { exerciseStats: null, weightChartData: [], repsChartData: [] };
      const duration = Date.now() - start;
      if (__DEV__) {
        console.log(`[STATS] WorkoutStatistics - chartData memo: ${duration}ms`);
        console.log(`[STATS] WorkoutStatistics - averages memo: ${duration}ms`);
      }
      return result;
    }

    // Downsample to weekly averages for Yearly view (max ~52 points instead of 365)
    let chartDates = dates;
    let chartWeights = weights;
    let chartReps = reps;

    if (dataPeriod === "Yearly") {
      const weeklyGroups = new Map<string, { weights: number[]; reps: number[]; date: Date }>();

      dates.forEach((date, idx) => {
        const startOfWeek = getStartOfWeek(date);
        const key = startOfWeek.toISOString();
        const existing = weeklyGroups.get(key);
        if (existing) {
          existing.weights.push(weights[idx]);
          existing.reps.push(reps[idx]);
        } else {
          weeklyGroups.set(key, {
            weights: [weights[idx]],
            reps: [reps[idx]],
            date: startOfWeek,
          });
        }
      });

      const sortedWeeks = Array.from(weeklyGroups.values()).sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );

      chartDates = sortedWeeks.map((w) => w.date);
      chartWeights = sortedWeeks.map((w) => {
        const sum = w.weights.reduce((s, val) => s + val, 0);
        return Math.round((sum / w.weights.length) * 10) / 10;
      });
      chartReps = sortedWeeks.map((w) => {
        const sum = w.reps.reduce((s, val) => s + val, 0);
        return Math.round(sum / w.reps.length);
      });
    }

    const rawWeightChartPoints: ChartDataPoint[] = chartDates.map((date, idx) => ({
      value: chartWeights[idx],
      label: date.toLocaleDateString(LOCALE_BY_LANGUAGE[language], {
        month: "short",
        day: "numeric",
      }),
    }));

    const rawRepsChartPoints: ChartDataPoint[] = chartDates.map((date, idx) => ({
      value: chartReps[idx],
      label: date.toLocaleDateString(LOCALE_BY_LANGUAGE[language], {
        month: "short",
        day: "numeric",
      }),
    }));

    const weightChartPoints = applyLabelFiltering(rawWeightChartPoints, "kg");
    const repsChartPoints = applyLabelFiltering(rawRepsChartPoints, "");

    const stats: ExerciseStats = {
      exerciseName: selectedExercise,
      totalWeight: Math.round(totalWeight),
      maxWeight: Math.round(maxWeight * 10) / 10,
      totalReps,
      averageTopSetReps: workoutCount > 0 ? Math.round(totalTopSetReps / workoutCount) : 0,
      workoutCount,
      dates: chartDates,
      weights: chartWeights,
      reps: chartReps,
    };

    const result = {
      exerciseStats: stats,
      weightChartData: weightChartPoints,
      repsChartData: repsChartPoints,
    };
    const duration = Date.now() - start;
    if (__DEV__) {
      console.log(`[STATS] WorkoutStatistics - chartData memo: ${duration}ms`);
      console.log(`[STATS] WorkoutStatistics - averages memo: ${duration}ms`);
    }
    return result;
  }, [filteredWorkouts, selectedExercise, dataPeriod, language]);

  const { exerciseStats, weightChartData, repsChartData } = exerciseStatsData;

  const chartSpacing = useMemo(() => {
    const pointCount = weightChartData.length;
    if (pointCount <= 1) return scale(60);

    const usableWidth = Math.max(chartWidth - scale(60), scale(180));
    const dynamicSpacing = usableWidth / (pointCount - 1);

    return Math.max(scale(35), Math.min(scale(60), dynamicSpacing));
  }, [chartWidth, weightChartData.length]);

  const handleSegmentChange = useCallback(
    (index: number) => {
      const nextPeriod = PERIODS[index];
      if (nextPeriod !== selectedPeriod) {
        periodChangeRef.current = {
          from: selectedPeriod,
          to: nextPeriod,
          startTime: Date.now(),
        };
        onPeriodChange(nextPeriod);
      }
    },
    [selectedPeriod, onPeriodChange]
  );

  const hasAnyWorkoutHistory = useMemo(() => {
    return workoutsHistory.some((workout) => !workout.isRestDay);
  }, [workoutsHistory]);

  if (loading && workoutsHistory.length === 0) {
    return (
      <View style={styles.initialLoadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    // Wrap in a swipeable container for period switching gestures
    <View {...periodPanResponder.panHandlers}>
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
            <Typo size={40} variant="metric" color={colors.primary} style={styles.statMetricText}>
              {totalWorkoutsCount}
            </Typo>
            <Typo size={13} color={colors.neutral400} style={styles.statLabelText}>
              {t("statistics_workouts")}
            </Typo>
          </View>
        </View>

        <View style={styles.stackedOuterFlex}>
          <View style={styles.shadowRounded17} />
          <View style={styles.statCard}>
            <Icons.TimerIcon size={24} color={colors.green} weight="fill" />
            <Typo size={40} variant="metric" color={colors.chartSuccess} style={styles.statMetricText}>
              {totalDurationMinutes}
            </Typo>
            <Typo size={13} color={colors.neutral400} style={styles.statLabelText}>
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
                <Typo size={16} fontWeight="600" color={colors.white} style={styles.centeredText}>
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
                        style={styles.centeredText}
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
                <Typo size={32} variant="metric" color={colors.primary} style={styles.exerciseStatMetricText}>
                  {exerciseStats.maxWeight} kg
                </Typo>
                <Typo size={13} color={colors.neutral400} style={styles.statLabelText}>
                  {t("statistics_max_weight")}
                </Typo>
              </View>
            </View>

            <View style={styles.stackedOuterFlex}>
              <View style={styles.shadowRounded15} />
              <View style={styles.exerciseStatCard}>
                <Icons.HashIcon size={24} color={colors.green} weight="fill" />
                <Typo size={32} variant="metric" color={colors.chartSuccess} style={styles.exerciseStatMetricText}>
                  {exerciseStats.totalReps}
                </Typo>
                <Typo size={13} color={colors.neutral400} style={styles.statLabelText}>
                  {t("statistics_total_reps")}
                </Typo>
              </View>
            </View>

            <View style={styles.stackedOuterFlex}>
              <View style={styles.shadowRounded15} />
              <View style={styles.exerciseStatCard}>
                <Icons.ScalesIcon size={24} color={colors.accent} weight="fill" />
                <Typo size={32} variant="metric" color={colors.accent} style={styles.exerciseStatMetricText}>
                  {exerciseStats.totalWeight}
                </Typo>
                <Typo size={13} color={colors.neutral400} style={styles.statLabelText}>
                  {t("statistics_total_kg")}
                </Typo>
              </View>
            </View>
          </View>

          {weightChartData.length > 0 && (
            <View style={styles.stackedOuterWithGap}>
              <View style={styles.shadowRounded17} />
              <View style={styles.chartContainer}>
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

                <View>
                  {chartReady ? (
                    <MemoizedLineChart
                      data={weightChartData}
                      width={chartWidth}
                      height={verticalScale(200)}
                      spacing={chartSpacing}
                      thickness={3}
                      color={colors.primary}
                      startFillColor={colors.primary}
                      endFillColor={colors.primary}
                      startOpacity={0.3}
                      endOpacity={0.1}
                      initialSpacing={scale(14)}
                      endSpacing={scale(14)}
                      noOfSections={4}
                      yAxisTextStyle={styles.chartYAxisText}
                      xAxisLabelTextStyle={styles.chartXAxisText}
                      hideRules
                      curved
                      areaChart
                      hideDataPoints={false}
                      dataPointsColor={colors.primary}
                      dataPointsRadius={4}
                      textShiftX={-5}
                      rotateLabel={true}
                      xAxisLabelsHeight={verticalScale(30)}
                      xAxisLabelsVerticalShift={5}
                      overflowTop={35}
                    />
                  ) : (
                    <ChartSkeleton color={colors.primary} />
                  )}
                </View>
              </View>
            </View>
          )}

          {repsChartData.length > 0 && (
            <View style={styles.stackedOuterWithGap}>
              <View style={styles.shadowRounded17} />
              <View style={styles.chartContainer}>
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

                <View>
                  {chartReady ? (
                    <MemoizedLineChart
                      data={repsChartData}
                      width={chartWidth}
                      height={verticalScale(200)}
                      spacing={chartSpacing}
                      thickness={3}
                      color={colors.green}
                      startFillColor={colors.green}
                      endFillColor={colors.green}
                      startOpacity={0.3}
                      endOpacity={0.1}
                      initialSpacing={scale(14)}
                      endSpacing={scale(14)}
                      noOfSections={4}
                      yAxisTextStyle={styles.chartYAxisText}
                      xAxisLabelTextStyle={styles.chartXAxisText}
                      hideRules
                      curved
                      areaChart
                      hideDataPoints={false}
                      dataPointsColor={colors.green}
                      dataPointsRadius={4}
                      textShiftX={-5}
                      rotateLabel={true}
                      xAxisLabelsHeight={verticalScale(30)}
                      xAxisLabelsVerticalShift={5}
                      overflowTop={35}
                    />
                  ) : (
                    <ChartSkeleton color={colors.green} />
                  )}
                </View>
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
            style={styles.emptyStateTitle}
          >
            {t("statistics_no_data_period")}
          </Typo>
          <Typo
            size={14}
            color={colors.neutral400}
            style={styles.emptyStateSubtitle}
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
            style={styles.emptyStateTitle}
          >
            {dataPeriod === "Weekly" && hasAnyWorkoutHistory
              ? t("statistics_no_workouts_this_week")
              : t("statistics_no_workouts_yet")}
          </Typo>
          <Typo
            size={14}
            color={colors.neutral400}
            style={styles.emptyStateSubtitle}
          >
            {dataPeriod === "Weekly" && hasAnyWorkoutHistory
              ? t("statistics_log_weekly")
              : t("statistics_start_training")}
          </Typo>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  initialLoadingContainer: {
    marginBottom: spacingY._12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: verticalScale(120),
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
  statMetricText: {
    marginTop: spacingY._7,
    textAlign: "center",
  },
  statLabelText: {
    textAlign: "center",
  },
  centeredText: {
    textAlign: "center",
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
  exerciseStatMetricText: {
    marginTop: spacingY._7,
    textAlign: "center",
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
    textAlign: "center",
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
    textAlign: "center",
  },
  chartYAxisText: {
    color: colors.neutral400,
    fontSize: verticalScale(12),
    textAlign: "center",
  },
  chartXAxisText: {
    color: colors.neutral400,
    fontSize: verticalScale(11),
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacingY._50,
  },
  emptyStateTitle: {
    marginTop: spacingY._15,
    textAlign: "center",
  },
  emptyStateSubtitle: {
    marginTop: spacingY._7,
    textAlign: "center",
  },
});

const areEqual = (prevProps: WorkoutStatisticsProps, nextProps: WorkoutStatisticsProps) => {
  // If becoming or staying inactive → skip ALL re-renders
  if (!nextProps.active) return true;
  // Only re-render active component when data changes
  return (
    prevProps.dataPeriod === nextProps.dataPeriod &&
    prevProps.selectedPeriod === nextProps.selectedPeriod &&
    prevProps.onPeriodChange === nextProps.onPeriodChange
  );
};

export default React.memo(WorkoutStatistics, areEqual);
