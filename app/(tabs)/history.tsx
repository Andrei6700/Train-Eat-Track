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
import {
  getUserWorkouts,
  type WorkoutQueryResult,
} from "@/src/services/workoutService";
import { DayWorkout, WorkoutHistory } from "@/src/types/index";
import { startOfDay, toDateKey, toValidDate } from "@/src/utils/dateKey";
import { verticalScale } from "@/src/utils/styling";
import {
  getCycleDayIndicesWithWorkouts,
  getCycleDayNameFromDate,
  shouldAutoConvertToRestDay,
} from "@/src/utils/workoutPlanCycle";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

const CACHE_MAX_AGE_MS = 60_000;

/**
 * #11 — cursor page size for incremental history loading.
 * The first open fetches only this many workouts (bounded query), then older
 * pages are loaded on-demand as the user scrolls back through the calendar.
 */
const HISTORY_PAGE_SIZE = 50;

const normalizeWorkoutHistory = (data: unknown): WorkoutHistory[] => {
  if (!Array.isArray(data)) return [];
  return data as WorkoutHistory[];
};

/**
 * #11 — dedupe accumulated pages by dateKey, preferring offline/queued drafts.
 * The service merges queued drafts into every page result; a queued draft with
 * no remote counterpart would otherwise be duplicated across pages on append.
 */
const dedupeByDateKeyPreferOffline = (
  items: WorkoutHistory[],
): WorkoutHistory[] => {
  const byKey = new Map<string, WorkoutHistory>();
  for (const item of items) {
    const d = toValidDate(item.date);
    if (!d) continue;
    const key = toDateKey(d);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }
    if (item.isOffline && !existing.isOffline) byKey.set(key, item);
  }
  return Array.from(byKey.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
};

/**
 * #11 — merge a fresh page-1 into a seeded (cached) full history.
 * Page 1 is authoritative for its date range (freshest remote); older cached
 * items outside that range are preserved. Avoids re-paginating the full history
 * on a quick re-focus within the cache TTL.
 */
const mergeFreshPage = (
  seeded: WorkoutHistory[],
  page: WorkoutHistory[],
): WorkoutHistory[] => {
  const pageKeys = new Set<string>();
  for (const p of page) {
    const d = toValidDate(p.date);
    if (d) pageKeys.add(toDateKey(d));
  }
  const older = seeded.filter((s) => {
    const d = toValidDate(s.date);
    if (!d) return true;
    return !pageKeys.has(toDateKey(d));
  });
  return dedupeByDateKeyPreferOffline([...page, ...older]);
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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(
    startOfDay(new Date()),
  );
  const [currentMonth, setCurrentMonth] = useState<Date>(
    startOfDay(new Date()),
  );
  /**
   * #11 — bumped on every load entry (focus/refresh). Passed to the calendar
   * strip so it only re-anchors the scroll on a new session, NOT when older
   * pages are prepended within the same session (which would yank the view).
   */
  const [sessionToken, setSessionToken] = useState(0);

  const requestIdRef = useRef(0);
  const lastVisibleIndexRef = useRef<number | null>(null);
  const initialDateKeyRef = useRef(toDateKey(startOfDay(new Date())));

  /** #11 — cursor + pagination state for incremental (fetchAll: false) loads. */
  const cursorRef = useRef<WorkoutQueryResult["nextCursor"]>(null);
  const hasMoreRef = useRef<boolean>(false);
  const accumulatingRef = useRef<boolean>(false);
  const seededFromCacheRef = useRef<boolean>(false);
  const earliestWorkoutDateRef = useRef<Date | null>(null);

  const { refresh, selectedDate: paramDate } = useLocalSearchParams();
  const isRefreshRequested = Array.isArray(refresh)
    ? refresh[0] === "true"
    : refresh === "true";

  /**
   * #11 — Loads ONE bounded page of older workouts using the cursor from #11.
   * Called from handleVisibleMonthChange when the user scrolls back to the
   * oldest loaded month. Guarded by accumulatingRef + requestId for cancellation.
   */
  const loadMorePages = useCallback(
    async (userId: string, requestId: number): Promise<void> => {
      if (accumulatingRef.current) return;
      accumulatingRef.current = true;
      try {
        while (
          hasMoreRef.current &&
          cursorRef.current &&
          requestId === requestIdRef.current
        ) {
          const result = await getUserWorkouts(userId, {
            fetchAll: false,
            startAfter: cursorRef.current,
            pageSize: HISTORY_PAGE_SIZE,
          });
          if (requestId !== requestIdRef.current) return;

          if (!result.success || !Array.isArray(result.data)) {
            hasMoreRef.current = false;
            break;
          }

          const page = normalizeWorkoutHistory(result.data);
          cursorRef.current = result.nextCursor ?? null;
          hasMoreRef.current = Boolean(result.hasMore);

          if (page.length === 0) {
            hasMoreRef.current = false;
            break;
          }

          setWorkoutsHistory((prev) => {
            const next = dedupeByDateKeyPreferOffline([...prev, ...page]);
            setWorkoutHistoryMemoryCache(userId, next);
            return next;
          });
        }
      } finally {
        if (requestId === requestIdRef.current) {
          accumulatingRef.current = false;
        }
      }
    },
    [],
  );

  const loadHistory = useCallback(
    async ({ isPullToRefresh = false }: { isPullToRefresh?: boolean } = {}) => {
      const userId = user?.uid;
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      // Reset any in-flight incremental pagination.
      accumulatingRef.current = false;
      cursorRef.current = null;
      hasMoreRef.current = false;
      setSessionToken((token) => token + 1);

      if (!userId) {
        clearWorkoutHistoryMemoryCache();
        setWorkoutsHistory([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const cachedHistory = getWorkoutHistoryMemoryCache(
        userId,
        CACHE_MAX_AGE_MS,
      );
      const canSeed =
        !isPullToRefresh && cachedHistory && cachedHistory.length > 0;
      if (canSeed) {
        setWorkoutsHistory(cachedHistory);
        setIsLoading(false);
        seededFromCacheRef.current = true;
      } else {
        seededFromCacheRef.current = false;
        if (!isPullToRefresh) setIsLoading(true);
      }

      try {
        // #11 — first paint fetches ONLY one bounded page (no unbounded getDocs).
        const firstPage = await getUserWorkouts(userId, {
          fetchAll: false,
          pageSize: HISTORY_PAGE_SIZE,
        });
        if (requestId !== requestIdRef.current) return;

        if (!firstPage.success || !Array.isArray(firstPage.data)) {
          if (!canSeed && requestId === requestIdRef.current) {
            setWorkoutsHistory([]);
          }
          if (__DEV__ && !firstPage.success) {
            console.error("Error fetching workouts:", firstPage.msg);
          }
          return;
        }

        const pageItems = normalizeWorkoutHistory(firstPage.data);

        if (seededFromCacheRef.current && cachedHistory) {
          // Quick re-focus within cache TTL: refresh recent items only,
          // don't re-paginate the full history.
          const merged = mergeFreshPage(cachedHistory, pageItems);
          setWorkoutsHistory(merged);
          setWorkoutHistoryMemoryCache(userId, merged);
          cursorRef.current = null;
          hasMoreRef.current = false;
        } else {
          // Fresh open: show page 1 immediately; older pages load on scroll.
          setWorkoutsHistory(pageItems);
          setWorkoutHistoryMemoryCache(userId, pageItems);
          cursorRef.current = firstPage.nextCursor ?? null;
          hasMoreRef.current = Boolean(firstPage.hasMore);
        }
      } catch (error) {
        if (__DEV__) {
          console.error("Error fetching workouts history:", error);
        }
        if (!canSeed && requestId === requestIdRef.current) {
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

  // #11 — keep a ref of the earliest loaded date for the load-on-scroll trigger.
  useEffect(() => {
    earliestWorkoutDateRef.current = earliestWorkoutDate;
  }, [earliestWorkoutDate]);

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

      setCurrentMonth((previousMonth) => {
        const isSameMonth =
          previousMonth.getMonth() === visibleDay.getMonth() &&
          previousMonth.getFullYear() === visibleDay.getFullYear();

        return isSameMonth ? previousMonth : visibleDay;
      });

      // #11 — load-on-scroll: when the user scrolls back to the oldest loaded
      // month, fetch the next bounded page (cursor pagination) to extend the
      // calendar backwards. Self-corrects the cycle/auto-rest logic for the
      // newly visible range.
      const userId = user?.uid;
      const earliest = earliestWorkoutDateRef.current;
      const nearEarliest =
        earliest != null &&
        visibleDay.getFullYear() === earliest.getFullYear() &&
        visibleDay.getMonth() === earliest.getMonth();

      if (
        userId &&
        nearEarliest &&
        hasMoreRef.current &&
        !accumulatingRef.current &&
        cursorRef.current
      ) {
        const requestId = requestIdRef.current;
        setIsLoadingMore(true);
        void loadMorePages(userId, requestId).finally(() => {
          if (requestId === requestIdRef.current) setIsLoadingMore(false);
        });
      }
    },
    [calendarIndexByDateKey, user?.uid, loadMorePages],
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
              {isLoadingMore && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
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
              sessionToken={sessionToken}
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