import { colors, spacingX, spacingY } from "@/constants/theme";
import HistoryCalendarStrip from "@/src/components/history/HistoryCalendarStrip";
import HistoryContentState from "@/src/components/history/HistoryContentState";
import Header from "@/src/components/layout/Header";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import SwipeableScreen from "@/src/components/layout/SwipeableScreen";
import Loading from "@/src/components/ui/Loading";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useLanguage } from "@/src/contexts/languageContext";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import { MONTH_NAMES } from "@/src/i18n/translations";
import {
  clearWorkoutHistoryMemoryCache,
  getWorkoutHistoryMemoryCache,
  setWorkoutHistoryMemoryCache,
} from "@/src/services/workoutHistoryMemoryCache";
import { getUserWorkouts } from "@/src/services/workoutService";
import { DayWorkout, WorkoutHistory } from "@/src/types/index";
import { startOfDay, toDateKey, toValidDate } from "@/src/utils/dateKey";
import { verticalScale } from "@/src/utils/styling";
import {
  getCycleDayIndicesWithWorkouts,
  getCycleDayNameFromDate,
  shouldAutoConvertToRestDay,
} from "@/src/utils/workoutPlanCycle";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { logPress, logEvent, logError } from "@/src/utils/perfMonitor";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

const CACHE_MAX_AGE_MS = 60_000;

const normalizeWorkoutHistory = (data: unknown): WorkoutHistory[] => {
  if (!Array.isArray(data)) return [];
  return data as WorkoutHistory[];
};

const getSafeParamDate = (
  value: string | string[] | undefined,
): Date | null => {
  const rawDate = Array.isArray(value) ? value[0] : value;
  const parsedDate = toValidDate(rawDate);
  if (!parsedDate) return null;

  const normalizedDate = startOfDay(parsedDate);
  const today = startOfDay(new Date());
  return normalizedDate > today ? today : normalizedDate;
};

const getInitialIndex = (
  calendarDays: Date[],
  targetDateKey: string,
): number | null => {
  if (calendarDays.length === 0) return null;

  const selectedIndex = calendarDays.findIndex(
    (day) => toDateKey(day) === targetDateKey,
  );
  if (selectedIndex !== -1) return selectedIndex;

  const todayKey = toDateKey(startOfDay(new Date()));
  const todayIndex = calendarDays.findIndex(
    (day) => toDateKey(day) === todayKey,
  );

  if (todayIndex !== -1) return todayIndex;
  return Math.max(calendarDays.length - 2, 0);
};

const History = () => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { workoutPlan } = useWorkoutPlan();

  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(
    startOfDay(new Date()),
  );
  const [currentMonth, setCurrentMonth] = useState<Date>(
    startOfDay(new Date()),
  );

  const requestIdRef = useRef(0);
  const lastVisibleIndexRef = useRef<number | null>(null);
  const initialDateKeyRef = useRef(toDateKey(startOfDay(new Date())));

  const { refresh, selectedDate: paramDate } = useLocalSearchParams();
  const isRefreshRequested = Array.isArray(refresh)
    ? refresh[0] === "true"
    : refresh === "true";

  const loadHistory = useCallback(
    async ({ isPullToRefresh = false }: { isPullToRefresh?: boolean } = {}) => {
      const userId = user?.uid;
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      const startMs = Date.now();
      const triggerReason = isPullToRefresh ? "pull_to_refresh" : "screen_focus";

      if (!userId) {
        clearWorkoutHistoryMemoryCache();
        setWorkoutsHistory([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      console.log(`[CALENDAR_LOG] [Screen: History] [Trigger: ${triggerReason}] Starting load...`);

      const cachedHistory = getWorkoutHistoryMemoryCache(
        userId,
        CACHE_MAX_AGE_MS,
      );
      if (cachedHistory) {
        logEvent("Cache", "History Sync Hit", { count: cachedHistory.length, durationMs: Date.now() - startMs });
        console.log(`[CALENDAR_LOG] [Screen: History] [Trigger: ${triggerReason}] Cache HIT. Loaded ${cachedHistory.length} workouts in ${Date.now() - startMs}ms.`);
        setWorkoutsHistory(cachedHistory);
        setIsLoading(false);
      } else if (!isPullToRefresh) {
        logEvent("Cache", "History Sync Miss");
        console.log(`[CALENDAR_LOG] [Screen: History] [Trigger: ${triggerReason}] Cache MISS. Triggering loading state.`);
        setIsLoading(true);
      }

      try {
        const remoteStart = Date.now();
        const result = await getUserWorkouts(userId);
        if (requestId !== requestIdRef.current) {
          console.log(`[CALENDAR_LOG] [Screen: History] [Trigger: ${triggerReason}] Request superseded. Ignoring remote result.`);
          return;
        }

        const remoteDuration = Date.now() - remoteStart;

        if (result.success) {
          const nextHistory = normalizeWorkoutHistory(result.data);
          logEvent("Firestore", "History Sync Success", { count: nextHistory.length, durationMs: remoteDuration });
          console.log(`[CALENDAR_LOG] [Screen: History] [Trigger: ${triggerReason}] Remote LOAD successful. Fetched ${nextHistory.length} workouts from Firebase in ${remoteDuration}ms.`);
          setWorkoutsHistory(nextHistory);
          setWorkoutHistoryMemoryCache(userId, nextHistory);
        } else {
          logError("History Sync", result.msg, { durationMs: remoteDuration });
          console.error(`[CALENDAR_LOG] [Screen: History] [Trigger: ${triggerReason}] Remote LOAD failed in ${remoteDuration}ms.`, result.msg);
          if (!cachedHistory) {
            setWorkoutsHistory([]);
          }
        }
      } catch (error) {
        logError("History Data Lifecycle", error);
        console.error(`[CALENDAR_LOG] [Screen: History] [Trigger: ${triggerReason}] Error loading workout history:`, error);
        if (!cachedHistory && requestId === requestIdRef.current) {
          setWorkoutsHistory([]);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
          logEvent("Data Lifecycle", "History Load Operation End", { durationMs: Date.now() - startMs });
          console.log(`[CALENDAR_LOG] [Screen: History] [Trigger: ${triggerReason}] Total load operation completed in ${Date.now() - startMs}ms.`);
        }
      }
    },
    [user?.uid],
  );

  useFocusEffect(
    useCallback(() => {
      const parsedParamDate = getSafeParamDate(paramDate);
      if (parsedParamDate) {
        initialDateKeyRef.current = toDateKey(parsedParamDate);
        setSelectedDate(parsedParamDate);
        setCurrentMonth(parsedParamDate);
        lastVisibleIndexRef.current = null;
        console.log(`[CALENDAR_LOG] [Screen: History] [Trigger: screen_mount/focus_with_date] Selected date: ${toDateKey(parsedParamDate)}.`);
      } else if (isRefreshRequested) {
        const today = startOfDay(new Date());
        initialDateKeyRef.current = toDateKey(today);
        setSelectedDate(today);
        setCurrentMonth(today);
        lastVisibleIndexRef.current = null;
        console.log(`[CALENDAR_LOG] [Screen: History] [Trigger: screen_mount/focus_refresh] Initialized calendar to today.`);
      } else {
        console.log(`[CALENDAR_LOG] [Screen: History] [Trigger: screen_mount/focus] Screen focused. Initializing load...`);
      }

      if (isRefreshRequested) {
        setIsRefreshing(true);
      }

      void loadHistory({ isPullToRefresh: isRefreshRequested });

      return () => {
        requestIdRef.current += 1;
      };
    }, [isRefreshRequested, loadHistory, paramDate]),
  );

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

  const calendarDays = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const startDate = earliestWorkoutDate
      ? new Date(earliestWorkoutDate)
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

    return days;
  }, [earliestWorkoutDate]);

  const initialIndex = getInitialIndex(calendarDays, initialDateKeyRef.current);

  const workoutPlanByDayName = useMemo(() => {
    const map = new Map<string, DayWorkout>();
    for (const day of workoutPlan?.days || []) {
      map.set(day.day, day);
    }
    return map;
  }, [workoutPlan]);

  const restDayDateSet = useMemo(() => {
    const set = new Set<string>(loggedRestDayDateSet);
    if (!workoutPlan || calendarDays.length === 0) return set;

    // Pre-compute cycle day indices with workouts once (O(m))
    // instead of checking for every calendar day (avoiding O(n*m))
    const cycleDayIndicesWithWorkouts = getCycleDayIndicesWithWorkouts(
      workoutsHistory,
      workoutPlan,
    );

    for (const day of calendarDays) {
      const dayName = getCycleDayNameFromDate(day, workoutPlan);
      const isPlannedRestDay = Boolean(
        workoutPlanByDayName.get(dayName)?.isRestDay,
      );
      const isAutoRestDay = shouldAutoConvertToRestDay(
        day,
        workoutPlan,
        cycleDayIndicesWithWorkouts,
      );

      if (isPlannedRestDay || isAutoRestDay) {
        set.add(toDateKey(day));
      }
    }

    return set;
  }, [
    calendarDays,
    loggedRestDayDateSet,
    workoutPlan,
    workoutPlanByDayName,
    workoutsHistory,
  ]);

  const onRefresh = useCallback(() => {
    logPress("Pull to Refresh History");
    const today = startOfDay(new Date());
    initialDateKeyRef.current = toDateKey(today);
    setSelectedDate(today);
    setCurrentMonth(today);
    lastVisibleIndexRef.current = null;
    setIsRefreshing(true);
    void loadHistory({ isPullToRefresh: true });
  }, [loadHistory]);

  const selectedDateKey = toDateKey(selectedDate);
  const selectedDayWorkouts = historyByDateKey.get(selectedDateKey) ?? [];
  const selectedWorkout =
    selectedDayWorkouts.find((workout) => !workout.isRestDay) ?? null;
  const hasLoggedRestDay = selectedDayWorkouts.some(
    (workout) => workout.isRestDay,
  );

  const selectedPlanDay = useMemo(() => {
    if (!workoutPlan) return null;
    const dayName = getCycleDayNameFromDate(selectedDate, workoutPlan);
    return workoutPlanByDayName.get(dayName) ?? null;
  }, [selectedDate, workoutPlan, workoutPlanByDayName]);

  const isSelectedDayAutoRestDay = useMemo(() => {
    if (!workoutPlan) return false;
    const cycleDayIndicesWithWorkouts = getCycleDayIndicesWithWorkouts(
      workoutsHistory,
      workoutPlan,
    );
    return shouldAutoConvertToRestDay(
      selectedDate,
      workoutPlan,
      cycleDayIndicesWithWorkouts,
    );
  }, [selectedDate, workoutPlan, workoutsHistory]);

  const isSelectedDayRestDay =
    hasLoggedRestDay ||
    Boolean(selectedPlanDay?.isRestDay) ||
    isSelectedDayAutoRestDay;

  const calendarIndexByDateKey = useMemo(() => {
    const map = new Map<string, number>();
    calendarDays.forEach((day, index) => {
      map.set(toDateKey(day), index);
    });
    return map;
  }, [calendarDays]);

  const handleVisibleMonthChange = useCallback(
    (visibleDay: Date) => {
      const dayKey = toDateKey(visibleDay);
      const nextIndex = calendarIndexByDateKey.get(dayKey);
      if (nextIndex === undefined) return;

      if (lastVisibleIndexRef.current === nextIndex) return;
      lastVisibleIndexRef.current = nextIndex;

      const monthStr = `${visibleDay.getFullYear()}-${visibleDay.getMonth() + 1}`;
      logEvent("Swipe Gesture", "History Month Swiped", { month: monthStr });
      console.log(`[CALENDAR_LOG] [Screen: History] [Trigger: swipe_scroll] Calendar visible month changed to ${monthStr}.`);

      setCurrentMonth((previousMonth) => {
        const isSameMonth =
          previousMonth.getMonth() === visibleDay.getMonth() &&
          previousMonth.getFullYear() === visibleDay.getFullYear();

        return isSameMonth ? previousMonth : visibleDay;
      });
    },
    [calendarIndexByDateKey],
  );

  const hasAnyWorkouts = workoutsHistory.length > 0;

  const handleDayPress = useCallback((day: Date) => {
    const today = startOfDay(new Date());
    if (day > today) return;

    logPress("History Calendar Day Select", { date: toDateKey(day) });
    console.log(`[CALENDAR_LOG] [Screen: History] [Trigger: user_click_day] User selected day ${toDateKey(day)}.`);
    setSelectedDate(day);

    setCurrentMonth((previousMonth) => {
      const isSameMonth =
        previousMonth.getMonth() === day.getMonth() &&
        previousMonth.getFullYear() === day.getFullYear();

      return isSameMonth ? previousMonth : day;
    });
  }, []);

  const workoutPlanUpdatedAt =
    toValidDate(workoutPlan?.updatedAt)?.getTime() ?? 0;

  const calendarExtraDataToken = useMemo(
    () =>
      `${selectedDateKey}-${historySignature}-${restDayDateSet.size}-${workoutPlanUpdatedAt}`,
    [
      historySignature,
      restDayDateSet.size,
      selectedDateKey,
      workoutPlanUpdatedAt,
    ],
  );

  if (isLoading) {
    return (
      <ScreenWrapper>
        <View style={styles.container}>
          <Header title={t("tab_history")} style={styles.header} />
        </View>
        <Loading />
      </ScreenWrapper>
    );
  }

  return (
    <SwipeableScreen>
      <ScreenWrapper>
        <View style={styles.container}>
          <Header title={t("tab_history")} style={styles.header} />

          <View style={styles.monthHeader}>
            <Typo size={24} variant="heading" color={colors.textPrimary}>
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
          </View>

          {calendarDays.length > 0 && (
            <HistoryCalendarStrip
              calendarDays={calendarDays}
              selectedDateKey={selectedDateKey}
              initialIndex={initialIndex}
              historyDateSet={historyDateSet}
              restDayDateSet={restDayDateSet}
              extraDataToken={calendarExtraDataToken}
              onDayPress={handleDayPress}
              onVisibleMonthChange={handleVisibleMonthChange}
            />
          )}

          <View style={styles.contentSection}>
            <ScrollView
              contentContainerStyle={styles.scrollViewContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                />
              }
            >
              <HistoryContentState
                selectedWorkout={selectedWorkout}
                hasAnyWorkouts={hasAnyWorkouts}
                isSelectedDayRestDay={isSelectedDayRestDay}
              />
            </ScrollView>
          </View>
        </View>
      </ScreenWrapper>
    </SwipeableScreen>
  );
};

export default History;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  header: {
    marginVertical: spacingY._10,
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
  contentSection: {
    flex: 1,
    marginTop: spacingY._10,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: verticalScale(20),
  },
});
