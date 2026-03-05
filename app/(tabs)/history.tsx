import { colors, spacingX, spacingY } from "@/constants/theme";
import HistoryCalendarStrip from "@/src/components/history/HistoryCalendarStrip";
import HistoryContentState from "@/src/components/history/HistoryContentState";
import Header from "@/src/components/layout/Header";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import SwipeableScreen from "@/src/components/layout/SwipeableScreen";
import Loading from "@/src/components/ui/Loading";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import {
  clearWorkoutHistoryMemoryCache,
  getWorkoutHistoryMemoryCache,
  setWorkoutHistoryMemoryCache,
} from "@/src/services/workoutHistoryMemoryCache";
import { getUserWorkouts } from "@/src/services/workoutService";
import { WorkoutHistory } from "@/src/types/index";
import { startOfDay, toDateKey, toValidDate } from "@/src/utils/dateKey";
import { verticalScale } from "@/src/utils/styling";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAYS_FULL = ["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"];
const CACHE_MAX_AGE_MS = 60_000;

const normalizeWorkoutHistory = (data: unknown): WorkoutHistory[] => {
  if (!Array.isArray(data)) return [];
  return data as WorkoutHistory[];
};

const getSafeParamDate = (value: string | string[] | undefined): Date | null => {
  const rawDate = Array.isArray(value) ? value[0] : value;
  const parsedDate = toValidDate(rawDate);
  if (!parsedDate) return null;

  const normalizedDate = startOfDay(parsedDate);
  const today = startOfDay(new Date());
  return normalizedDate > today ? today : normalizedDate;
};

const getInitialIndex = (calendarDays: Date[], targetDateKey: string): number | null => {
  if (calendarDays.length === 0) return null;

  const selectedIndex = calendarDays.findIndex(
    (day) => toDateKey(day) === targetDateKey,
  );
  if (selectedIndex !== -1) return selectedIndex;

  const todayKey = toDateKey(startOfDay(new Date()));
  const todayIndex = calendarDays.findIndex((day) => toDateKey(day) === todayKey);

  if (todayIndex !== -1) return todayIndex;
  return Math.max(calendarDays.length - 2, 0);
};

const History = () => {
  const { user } = useAuth();
  const { workoutPlan } = useWorkoutPlan();

  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfDay(new Date()));

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

      if (!userId) {
        clearWorkoutHistoryMemoryCache();
        setWorkoutsHistory([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const cachedHistory = getWorkoutHistoryMemoryCache(userId, CACHE_MAX_AGE_MS);
      if (cachedHistory) {
        setWorkoutsHistory(cachedHistory);
        setIsLoading(false);
      } else if (!isPullToRefresh) {
        setIsLoading(true);
      }

      try {
        const result = await getUserWorkouts(userId);
        if (requestId !== requestIdRef.current) return;

        if (result.success) {
          const nextHistory = normalizeWorkoutHistory(result.data);
          setWorkoutsHistory(nextHistory);
          setWorkoutHistoryMemoryCache(userId, nextHistory);
        } else if (!cachedHistory) {
          setWorkoutsHistory([]);
          console.error("Error fetching workouts:", result.msg);
        }
      } catch (error) {
        console.error("Error fetching workouts history:", error);
        if (!cachedHistory && requestId === requestIdRef.current) {
          setWorkoutsHistory([]);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
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
      } else if (isRefreshRequested) {
        const today = startOfDay(new Date());
        initialDateKeyRef.current = toDateKey(today);
        setSelectedDate(today);
        setCurrentMonth(today);
        lastVisibleIndexRef.current = null;
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

  const { historyByDateKey, historyDateSet, earliestWorkoutDate, historySignature } =
    useMemo(() => {
      const byDateKey = new Map<string, WorkoutHistory>();
      const dateSet = new Set<string>();
      let earliestTimestamp: number | null = null;

      for (const workout of workoutsHistory) {
        const parsedDate = toValidDate(workout.date);
        if (!parsedDate) continue;

        const normalizedDate = startOfDay(parsedDate);
        const dayKey = toDateKey(normalizedDate);
        const dayTimestamp = normalizedDate.getTime();

        if (!byDateKey.has(dayKey)) {
          byDateKey.set(dayKey, workout);
        }

        dateSet.add(dayKey);

        if (earliestTimestamp === null || dayTimestamp < earliestTimestamp) {
          earliestTimestamp = dayTimestamp;
        }
      }

      let keyHash = 0;
      const sortedKeys = [...dateSet].sort();
      for (const key of sortedKeys) {
        for (let idx = 0; idx < key.length; idx += 1) {
          keyHash = (keyHash * 31 + key.charCodeAt(idx)) | 0;
        }
      }

      return {
        historyByDateKey: byDateKey,
        historyDateSet: dateSet,
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

  const initialIndex = getInitialIndex(
    calendarDays,
    initialDateKeyRef.current,
  );

  const workoutPlanByDayName = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const day of workoutPlan?.days || []) {
      map.set(day.day, day.isRestDay);
    }
    return map;
  }, [workoutPlan]);

  const restDayDateSet = useMemo(() => {
    const set = new Set<string>();
    if (!workoutPlan || calendarDays.length === 0) return set;

    for (const day of calendarDays) {
      const dayOfWeek = day.getDay();
      const adjustedDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const dayName = DAYS_FULL[adjustedDayOfWeek];
      if (workoutPlanByDayName.get(dayName)) {
        set.add(toDateKey(day));
      }
    }

    return set;
  }, [calendarDays, workoutPlan, workoutPlanByDayName]);

  const onRefresh = useCallback(() => {
    const today = startOfDay(new Date());
    initialDateKeyRef.current = toDateKey(today);
    setSelectedDate(today);
    setCurrentMonth(today);
    lastVisibleIndexRef.current = null;
    setIsRefreshing(true);
    void loadHistory({ isPullToRefresh: true });
  }, [loadHistory]);

  const selectedDateKey = toDateKey(selectedDate);
  const selectedWorkout = historyByDateKey.get(selectedDateKey) ?? null;

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

    setSelectedDate(day);

    setCurrentMonth((previousMonth) => {
      const isSameMonth =
        previousMonth.getMonth() === day.getMonth() &&
        previousMonth.getFullYear() === day.getFullYear();

      return isSameMonth ? previousMonth : day;
    });
  }, []);

  const workoutPlanUpdatedAt = toValidDate(workoutPlan?.updatedAt)?.getTime() ?? 0;

  const calendarExtraDataToken = useMemo(
    () =>
      `${selectedDateKey}-${historySignature}-${restDayDateSet.size}-${workoutPlanUpdatedAt}`,
    [historySignature, restDayDateSet.size, selectedDateKey, workoutPlanUpdatedAt],
  );

  if (isLoading) {
    return (
      <ScreenWrapper>
        <View style={styles.container}>
          <Header title="History" style={styles.header} />
        </View>
        <Loading />
      </ScreenWrapper>
    );
  }

  return (
    <SwipeableScreen>
      <ScreenWrapper>
        <View style={styles.container}>
          <Header title="History" style={styles.header} />

          <View style={styles.monthHeader}>
            <Typo size={20} fontWeight="600" color={colors.white}>
              {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </Typo>
            <View style={styles.statsRow}>
              <Typo size={14} color={colors.neutral400}>
                {workoutsHistory.length} workout
                {workoutsHistory.length !== 1 ? "s" : ""}
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
