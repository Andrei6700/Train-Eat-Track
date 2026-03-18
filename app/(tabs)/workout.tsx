import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import SwipeableScreen from "@/src/components/layout/SwipeableScreen";
import Loading from "@/src/components/ui/Loading";
import Typo from "@/src/components/ui/Typo";
import WorkoutCalendarStrip from "@/src/components/workout/WorkoutCalendarStrip";
import WorkoutContentState from "@/src/components/workout/WorkoutContentState";
import { useAuth } from "@/src/contexts/authContext";
import { useLanguage } from "@/src/contexts/languageContext";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import { MONTH_NAMES } from "@/src/i18n/translations";
import {
    clearWorkoutHistoryMemoryCache,
    getWorkoutHistoryMemoryCache,
    setWorkoutHistoryMemoryCache,
} from "@/src/services/workoutHistoryMemoryCache";
import {
    checkWorkoutExistsToday,
    getUserWorkouts,
} from "@/src/services/workoutService";
import { DayWorkout, WorkoutHistory } from "@/src/types/index";
import { startOfDay, toDateKey, toValidDate } from "@/src/utils/dateKey";
import { verticalScale } from "@/src/utils/styling";
import {
    getCycleDayIndex,
    getCycleDayNameFromDate,
    isFirstCycle,
    isFirstCycleEmptyDay,
    shouldAutoConvertToRestDay,
} from "@/src/utils/workoutPlanCycle";
import { useFocusEffect, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

const CACHE_MAX_AGE_MS = 60_000;

const normalizeWorkoutHistory = (data: unknown): WorkoutHistory[] => {
  if (!Array.isArray(data)) return [];
  return data as WorkoutHistory[];
};

const hasWorkoutForDate = (
  history: WorkoutHistory[],
  dayKey: string,
): boolean =>
  history.some((item) => {
    const date = toValidDate(item.date);
    return date ? toDateKey(date) === dayKey : false;
  });

const buildCalendarDays = (history: WorkoutHistory[]) => {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  let earliestWorkoutTimestamp: number | null = null;

  for (const workout of history) {
    const parsedDate = toValidDate(workout.date);
    if (!parsedDate) continue;

    const timestamp = startOfDay(parsedDate).getTime();
    if (
      earliestWorkoutTimestamp === null ||
      timestamp < earliestWorkoutTimestamp
    ) {
      earliestWorkoutTimestamp = timestamp;
    }
  }

  const startDate =
    earliestWorkoutTimestamp !== null
      ? new Date(earliestWorkoutTimestamp)
      : new Date(today.getFullYear(), today.getMonth(), 1);

  const firstDayOfMonth = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    1,
  );

  const days: Date[] = [];
  for (
    let day = new Date(firstDayOfMonth);
    day <= tomorrow;
    day.setDate(day.getDate() + 1)
  ) {
    days.push(new Date(day));
  }

  const todayKey = toDateKey(today);
  const todayIndex = days.findIndex((date) => toDateKey(date) === todayKey);
  const safeIndex =
    todayIndex !== -1 ? todayIndex : Math.max(days.length - 2, 0);

  return { days, safeIndex };
};

const Workout = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { workoutPlan } = useWorkoutPlan();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>([]);
  const [hasWorkoutToday, setHasWorkoutToday] = useState(false);
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);
  const [initialIndex, setInitialIndex] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date>(startOfDay(new Date()));
  const [currentMonth, setCurrentMonth] = useState<Date>(
    startOfDay(new Date()),
  );
  const requestIdRef = useRef(0);

  const workoutPlanName = workoutPlan?.planName || "";

  const workoutPlanByDayName = useMemo(() => {
    const map = new Map<string, DayWorkout>();
    for (const day of workoutPlan?.days || []) {
      map.set(day.day, day);
    }
    return map;
  }, [workoutPlan]);

  const {
    historyByDateKey,
    historyDateSet,
    loggedRestDayDateSet,
    earliestWorkoutDate,
    historySignature,
  } = useMemo(() => {
    const byDateKey = new Map<string, WorkoutHistory[]>();
    const workoutDateSet = new Set<string>();
    const restDateSet = new Set<string>();
    let earliestTimestamp: number | null = null;

    for (const workout of workoutsHistory) {
      const parsedDate = toValidDate(workout.date);
      if (!parsedDate) continue;

      const normalizedDate = startOfDay(parsedDate);
      const dayKey = toDateKey(normalizedDate);
      const dayTimestamp = normalizedDate.getTime();

      const workoutsForDay = byDateKey.get(dayKey) || [];
      workoutsForDay.push(workout);
      byDateKey.set(dayKey, workoutsForDay);

      if (workout.isRestDay) {
        restDateSet.add(dayKey);
      } else {
        workoutDateSet.add(dayKey);
      }

      if (earliestTimestamp === null || dayTimestamp < earliestTimestamp) {
        earliestTimestamp = dayTimestamp;
      }
    }

    let keyHash = 0;
    const sortedKeys = [...byDateKey.keys()].sort();
    for (const key of sortedKeys) {
      for (let idx = 0; idx < key.length; idx += 1) {
        keyHash = (keyHash * 31 + key.charCodeAt(idx)) | 0;
      }
    }

    return {
      historyByDateKey: byDateKey,
      historyDateSet: workoutDateSet,
      loggedRestDayDateSet: restDateSet,
      earliestWorkoutDate:
        earliestTimestamp !== null ? new Date(earliestTimestamp) : null,
      historySignature: `${sortedKeys.length}-${keyHash}`,
    };
  }, [workoutsHistory]);

  const selectedDayKey = toDateKey(selectedDay);
  const today = startOfDay(new Date());
  const todayKey = toDateKey(today);

  const isSelectedDayToday = selectedDayKey === todayKey;
  const isSelectedDayPast = selectedDay < today;
  const isSelectedDayFuture = selectedDay > today;

  const selectedDayWorkouts = historyByDateKey.get(selectedDayKey) ?? [];
  const selectedWorkout =
    selectedDayWorkouts.find((workout) => !workout.isRestDay) ?? null;
  const hasLoggedRestDay = selectedDayWorkouts.some(
    (workout) => workout.isRestDay,
  );

  const selectedPlanDay = useMemo(() => {
    if (!workoutPlan) return null;
    const dayName = getCycleDayNameFromDate(selectedDay, workoutPlan);
    return workoutPlanByDayName.get(dayName) ?? null;
  }, [selectedDay, workoutPlan, workoutPlanByDayName]);

  const isAutoRestDay = useMemo(() => {
    if (!workoutPlan) return false;
    return shouldAutoConvertToRestDay(selectedDay, workoutPlan, workoutsHistory);
  }, [selectedDay, workoutPlan, workoutsHistory]);

  const isSelectedFirstCycleEmpty = useMemo(() => {
    if (!workoutPlan) return false;
    return isFirstCycleEmptyDay(selectedDay, workoutPlan);
  }, [selectedDay, workoutPlan]);

  const isSelectedDayRestDay =
    hasLoggedRestDay || Boolean(selectedPlanDay?.isRestDay) || isAutoRestDay;

  const restDayDateSet = useMemo(() => {
    const set = new Set<string>(loggedRestDayDateSet);
    if (!workoutPlan || calendarDays.length === 0) return set;

    // Pre-compute which cycle day indices have ever had workouts logged
    const workedOutCycleDays = new Set<number>();
    for (const workout of workoutsHistory) {
      if (workout.isRestDay || !workout.exercises?.length) continue;
      const workoutDate = toValidDate(workout.date);
      if (!workoutDate) continue;
      workedOutCycleDays.add(getCycleDayIndex(workoutDate, workoutPlan));
    }

    for (const day of calendarDays) {
      const dayName = getCycleDayNameFromDate(day, workoutPlan);
      const planDay = workoutPlanByDayName.get(dayName);
      if (planDay?.isRestDay) {
        set.add(toDateKey(day));
        continue;
      }
      // Auto-rest: empty plan day, past first cycle, never worked out
      if (
        planDay &&
        !planDay.isRestDay &&
        (!planDay.exercises || planDay.exercises.length === 0) &&
        !isFirstCycle(day, workoutPlan)
      ) {
        const cycleDayIdx = getCycleDayIndex(day, workoutPlan);
        if (!workedOutCycleDays.has(cycleDayIdx)) {
          set.add(toDateKey(day));
        }
      }
    }

    return set;
  }, [calendarDays, loggedRestDayDateSet, workoutPlan, workoutPlanByDayName, workoutsHistory]);

  const shouldShowLogButton = useMemo(() => {
    if (isSelectedDayToday) return false;
    if (isSelectedDayFuture) return false;
    if (selectedWorkout) return false;
    if (isSelectedDayRestDay) return false;
    if (!earliestWorkoutDate) return false;

    return selectedDay.getTime() >= earliestWorkoutDate.getTime();
  }, [
    earliestWorkoutDate,
    isSelectedDayFuture,
    isSelectedDayRestDay,
    isSelectedDayToday,
    selectedDay,
    selectedWorkout,
  ]);

  const workoutPlanUpdatedAt =
    toValidDate(workoutPlan?.updatedAt)?.getTime() ?? 0;

  const calendarExtraDataToken = useMemo(
    () =>
      `${selectedDayKey}-${historySignature}-${restDayDateSet.size}-${workoutPlanUpdatedAt}`,
    [
      historySignature,
      restDayDateSet.size,
      selectedDayKey,
      workoutPlanUpdatedAt,
    ],
  );

  const loadWorkoutData = useCallback(
    async ({ isPullToRefresh = false }: { isPullToRefresh?: boolean } = {}) => {
      const userId = user?.uid;
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      if (!userId) {
        clearWorkoutHistoryMemoryCache();
        setWorkoutsHistory([]);
        setHasWorkoutToday(false);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const cachedHistory = getWorkoutHistoryMemoryCache(
        userId,
        CACHE_MAX_AGE_MS,
      );
      if (cachedHistory) {
        setWorkoutsHistory(cachedHistory);
        setHasWorkoutToday(hasWorkoutForDate(cachedHistory, todayKey));
        setLoading(false);
      } else if (!isPullToRefresh) {
        setLoading(true);
      }

      try {
        const [historyResult, existsResult] = await Promise.allSettled([
          getUserWorkouts(userId),
          checkWorkoutExistsToday(userId),
        ]);

        if (requestId !== requestIdRef.current) return;

        let nextHistory = cachedHistory ?? [];

        if (
          historyResult.status === "fulfilled" &&
          historyResult.value.success
        ) {
          nextHistory = normalizeWorkoutHistory(historyResult.value.data);
          setWorkoutsHistory(nextHistory);
          setWorkoutHistoryMemoryCache(userId, nextHistory);
        } else if (!cachedHistory) {
          nextHistory = [];
          setWorkoutsHistory([]);
        }

        if (existsResult.status === "fulfilled") {
          setHasWorkoutToday(Boolean(existsResult.value.data?.exists));
        } else {
          setHasWorkoutToday(hasWorkoutForDate(nextHistory, todayKey));
        }
      } catch {
        if (!cachedHistory && requestId === requestIdRef.current) {
          setWorkoutsHistory([]);
          setHasWorkoutToday(false);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [todayKey, user?.uid],
  );

  useFocusEffect(
    useCallback(() => {
      const nextSelectedDay = startOfDay(new Date());
      setSelectedDay(nextSelectedDay);
      setCurrentMonth(nextSelectedDay);
      void loadWorkoutData();

      return () => {
        requestIdRef.current += 1;
      };
    }, [loadWorkoutData]),
  );

  useEffect(() => {
    const { days, safeIndex } = buildCalendarDays(workoutsHistory);
    setCalendarDays(days);
    setInitialIndex(safeIndex);

    if (days.length === 0) return;

    const safeDay = days[safeIndex] || startOfDay(new Date());
    setSelectedDay(safeDay);
    setCurrentMonth(safeDay);
  }, [workoutsHistory]);

  const handleDayPress = useCallback((day: Date) => {
    const todayDate = startOfDay(new Date());
    if (day > todayDate) return;

    setSelectedDay(day);
    setCurrentMonth((prev) => {
      const isSameMonth =
        prev.getFullYear() === day.getFullYear() &&
        prev.getMonth() === day.getMonth();
      return isSameMonth ? prev : day;
    });
  }, []);

  const handleVisibleMonthChange = useCallback((day: Date) => {
    setCurrentMonth((prev) => {
      const isSameMonth =
        prev.getFullYear() === day.getFullYear() &&
        prev.getMonth() === day.getMonth();
      return isSameMonth ? prev : day;
    });
  }, []);

  const handleLogWorkout = useCallback(() => {
    const safeSelectedDate = Number.isFinite(selectedDay.getTime())
      ? selectedDay
      : new Date();

    router.push({
      pathname: "/(modals)/addWorkout",
      params: {
        selectedDate: safeSelectedDate.toISOString(),
        isHistorical: (!isSelectedDayToday).toString(),
      },
    });
  }, [isSelectedDayToday, router, selectedDay]);

  const handleStartWorkout = useCallback(() => {
    if (!isSelectedDayToday) return;

    const todayDate = new Date();
    if (hasWorkoutToday) {
      router.push({
        pathname: "/(tabs)/history",
        params: {
          selectedDate: todayDate.toISOString(),
          refresh: "true",
        },
      });
      return;
    }

    router.push("/(modals)/addWorkout");
  }, [hasWorkoutToday, isSelectedDayToday, router]);

  const handleEditPlan = useCallback(() => {
    router.push("/(modals)/workoutPlan");
  }, [router]);

  const onRefresh = useCallback(() => {
    const nextSelectedDay = startOfDay(new Date());
    setRefreshing(true);
    setSelectedDay(nextSelectedDay);
    setCurrentMonth(nextSelectedDay);
    void loadWorkoutData({ isPullToRefresh: true });
  }, [loadWorkoutData]);

  if (loading) {
    return (
      <SwipeableScreen>
        <ScreenWrapper>
          <View style={styles.container}>
            <Animated.View
              entering={FadeIn.duration(400)}
              style={styles.header}
            >
              <Typo size={28} fontWeight="700">
                {t("tab_workout")}
              </Typo>
              {workoutPlan && (
                <TouchableOpacity
                  onPress={handleEditPlan}
                  style={styles.headerEditButton}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t("workout_plan_modal_edit_title")}
                >
                  <Icons.PencilSimple
                    size={18}
                    color={colors.black}
                    weight="bold"
                  />
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>
          <Loading />
        </ScreenWrapper>
      </SwipeableScreen>
    );
  }

  return (
    <SwipeableScreen>
      <ScreenWrapper>
        <View style={styles.container}>
          <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
            <Typo size={28} fontWeight="700">
              {t("tab_workout")}
            </Typo>
            {workoutPlan && (
              <TouchableOpacity
                onPress={handleEditPlan}
                style={styles.headerEditButton}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t("workout_plan_modal_edit_title")}
              >
                <Icons.PencilSimple
                  size={18}
                  color={colors.black}
                  weight="bold"
                />
              </TouchableOpacity>
            )}
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(400).delay(100)}
            style={styles.monthHeader}
          >
            <Typo size={20} fontWeight="600" color={colors.white}>
              {MONTH_NAMES[language][currentMonth.getMonth()]}{" "}
              {currentMonth.getFullYear()}
            </Typo>
            <View style={styles.statsRow}>
              <Typo size={14} color={colors.neutral400}>
                {workoutsHistory.length}{" "}
                {workoutsHistory.length === 1
                  ? t("common_workout_singular")
                  : t("common_workout_plural")}
              </Typo>
            </View>
          </Animated.View>

          {calendarDays.length > 0 && (
            <Animated.View
              entering={FadeInDown.duration(400).delay(200)}
              style={styles.calendarSection}
            >
              <WorkoutCalendarStrip
                calendarDays={calendarDays}
                selectedDayKey={selectedDayKey}
                initialIndex={initialIndex}
                historyDateSet={historyDateSet}
                restDayDateSet={restDayDateSet}
                extraDataToken={calendarExtraDataToken}
                onDayPress={handleDayPress}
                onVisibleMonthChange={handleVisibleMonthChange}
              />
            </Animated.View>
          )}

          <View style={styles.contentSection}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                />
              }
            >
              <WorkoutContentState
                selectedWorkout={selectedWorkout}
                selectedPlanDay={selectedPlanDay}
                isSelectedDayRestDay={isSelectedDayRestDay}
                isFirstCycleEmptyDay={isSelectedFirstCycleEmpty}
                workoutPlan={workoutPlan}
                workoutPlanName={workoutPlanName}
                isSelectedDayToday={isSelectedDayToday}
                isSelectedDayPast={isSelectedDayPast}
                isSelectedDayFuture={isSelectedDayFuture}
                shouldShowLogButton={shouldShowLogButton}
                onStartWorkout={handleStartWorkout}
                onEditPlan={handleEditPlan}
                onLogWorkout={handleLogWorkout}
              />
            </ScrollView>
          </View>
        </View>
      </ScreenWrapper>
    </SwipeableScreen>
  );
};

export default Workout;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacingY._15,
  },
  headerEditButton: {
    width: verticalScale(36),
    height: verticalScale(36),
    borderRadius: radius._10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._15,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  calendarSection: {
    marginBottom: spacingY._15,
  },
  contentSection: {
    flex: 1,
    marginTop: spacingY._10,
  },
  scrollContent: {
    paddingBottom: verticalScale(20),
    flexGrow: 1,
  },
});
