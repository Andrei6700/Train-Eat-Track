import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import SwipeableScreen from "@/src/components/layout/SwipeableScreen";
import Loading from "@/src/components/ui/Loading";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import {
  checkWorkoutExistsToday,
  getUserWorkouts,
} from "@/src/services/workoutService";
import { DayWorkout, WorkoutHistory } from "@/src/types/index";
import { scale, verticalScale } from "@/src/utils/styling";
import { FlashList } from "@shopify/flash-list";
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

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL = [
  "Luni",
  "Marti",
  "Miercuri",
  "Joi",
  "Vineri",
  "Sambata",
  "Duminica",
];
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

const DAY_WIDTH = scale(50);
const ITEM_SPACING = scale(8);
const ITEM_WIDTH = DAY_WIDTH + ITEM_SPACING;

const DayCard = React.memo(
  ({
    day,
    index,
    isTodayCard,
    isSelected,
    isRest,
    hasWorkoutOnDay,
    hasWorkoutToday,
    isFuture,
    onPress,
  }: any) => {
    const dayOfWeek = day.getDay() === 0 ? 6 : day.getDay() - 1;

    return (
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.dayCard,
          isSelected && styles.dayCardSelected,
          isFuture && styles.dayCardFuture,
        ]}
        activeOpacity={isFuture ? 1 : 0.7}
        disabled={isFuture}
      >
        <Typo
          size={12}
          color={
            isFuture
              ? colors.neutral600
              : isSelected
              ? colors.black
              : colors.neutral400
          }
          fontWeight="500"
        >
          {DAYS_SHORT[dayOfWeek]}
        </Typo>

        <View
          style={[
            styles.dayNumber,
            isTodayCard && !isSelected && styles.dayNumberToday,
          ]}
        >
          <Typo
            size={18}
            fontWeight={isSelected || isTodayCard ? "700" : "500"}
            color={
              isFuture
                ? colors.neutral600
                : isSelected
                ? colors.black
                : isTodayCard
                ? colors.primary
                : colors.white
            }
          >
            {day.getDate()}
          </Typo>
        </View>

        <View style={styles.indicators}>
          {hasWorkoutOnDay && (
            <View
              style={[
                styles.workoutDot,
                isSelected && styles.workoutDotSelected,
              ]}
            />
          )}
          {isRest && !hasWorkoutOnDay && (
            <Icons.Coffee
              size={12}
              color={isSelected ? colors.neutral700 : colors.neutral500}
              weight="fill"
            />
          )}
        </View>
      </TouchableOpacity>
    );
  }
);

const Workout = React.memo(() => {
  const router = useRouter();
  const { user } = useAuth();
  const { workoutPlan } = useWorkoutPlan();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentWeek, setCurrentWeek] = useState<Date[]>([]);
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [todayIndex, setTodayIndex] = useState(0);
  const [initialIndex, setInitialIndex] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [todayWorkout, setTodayWorkout] = useState<DayWorkout | null>(null);
  const [workoutPlanName, setWorkoutPlanName] = useState("");
  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutHistory | null>(
    null
  );
  const [hasWorkoutToday, setHasWorkoutToday] = useState(false);
  const flashListRef = useRef<FlashList<Date>>(null);
  const didInitialScrollRef = useRef(false);

  const isSelectedDayToday = useMemo(() => {
    return selectedDay.toDateString() === new Date().toDateString();
  }, [selectedDay]);

  const isSelectedDayPast = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDay);
    selected.setHours(0, 0, 0, 0);
    return selected < today;
  }, [selectedDay]);

  const isSelectedDayFuture = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDay);
    selected.setHours(0, 0, 0, 0);
    return selected > today;
  }, [selectedDay]);

  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));

  // Calculate which day index in the split cycle a given date corresponds to
  const getDayIndexFromDate = useCallback(
    (date: Date): number => {
      if (!workoutPlan || !workoutPlan.splitDays) {
        // Fallback to weekly schedule if no split is defined
        return date.getDay() === 0 ? 6 : date.getDay() - 1;
      }

      // Handle both Firestore Timestamp and Date objects
      let planCreatedDate: Date;
      if (
        workoutPlan.createdAt &&
        typeof workoutPlan.createdAt === "object" &&
        "toDate" in workoutPlan.createdAt
      ) {
        // Firestore Timestamp
        planCreatedDate = (workoutPlan.createdAt as any).toDate();
      } else {
        // Regular Date or string
        planCreatedDate = new Date(workoutPlan.createdAt);
      }
      planCreatedDate.setHours(0, 0, 0, 0);

      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);

      // Calculate days since plan was created
      const daysDifference = Math.floor(
        (targetDate.getTime() - planCreatedDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // Return the day index in the split cycle (0-indexed)
      return daysDifference % workoutPlan.splitDays;
    },
    [workoutPlan]
  );

  // Get the day name (e.g., "Day 1") for a given date based on split cycle
  const getDayNameFromDate = useCallback(
    (date: Date): string => {
      const dayIndex = getDayIndexFromDate(date);
      return `Day ${dayIndex + 1}`;
    },
    [getDayIndexFromDate]
  );

  // Generate calendar days from first workout to today
  const generateCalendarDays = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (workoutsHistory.length === 0) {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const days: Date[] = [];
      for (
        let d = new Date(firstDay);
        d <= tomorrow;
        d.setDate(d.getDate() + 1)
      ) {
        days.push(new Date(d));
      }

      setCalendarDays(days);
      const safeIndex = days.findIndex(
        (d) => d.toDateString() === today.toDateString()
      );
      setInitialIndex(safeIndex !== -1 ? safeIndex : days.length - 2);
      setSelectedDay(days[safeIndex !== -1 ? safeIndex : days.length - 2]);
      setCurrentMonth(days[safeIndex !== -1 ? safeIndex : days.length - 2]);
      return;
    }

    const sortedWorkouts = [...workoutsHistory].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const earliestWorkout = new Date(sortedWorkouts[0].date);
    earliestWorkout.setHours(0, 0, 0, 0);

    const firstDay = new Date(
      earliestWorkout.getFullYear(),
      earliestWorkout.getMonth(),
      1
    );

    const days: Date[] = [];
    for (
      let d = new Date(firstDay);
      d <= tomorrow;
      d.setDate(d.getDate() + 1)
    ) {
      days.push(new Date(d));
    }

    setCalendarDays(days);

    const safeIndex = days.findIndex(
      (d) => d.toDateString() === today.toDateString()
    );
    setInitialIndex(safeIndex !== -1 ? safeIndex : days.length - 2);
    setSelectedDay(days[safeIndex !== -1 ? safeIndex : days.length - 2]);
    setCurrentMonth(days[safeIndex !== -1 ? safeIndex : days.length - 2]);
  }, [workoutsHistory]);

  useFocusEffect(
    useCallback(() => {
      const today = new Date();
      setSelectedDay(today);
      setSelectedWorkout(null);

      if (user?.uid) {
        checkTodayWorkout();
        loadWorkoutsHistory();
      }

      loadTodayWorkout();

      return () => {};
    }, [user?.uid])
  );

  useEffect(() => {
    loadTodayWorkout();
  }, [user?.uid, workoutPlan]);

  useEffect(() => {
    if (workoutPlan === null) {
      setTodayWorkout(null);
      setWorkoutPlanName("");
    }
  }, [workoutPlan]);

  useEffect(() => {
    if (!loading) {
      didInitialScrollRef.current = false;
      generateCalendarDays();
    }
  }, [workoutsHistory, loading, generateCalendarDays]);

  // Check if workout exists today
  const checkTodayWorkout = useCallback(async () => {
    if (!user?.uid) return;

    const existsCheck = await checkWorkoutExistsToday(user.uid);
    setHasWorkoutToday(existsCheck.data?.exists || false);
  }, [user?.uid]);

  // Load workouts history
  const loadWorkoutsHistory = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const historyResult = await getUserWorkouts(user.uid);
      if (historyResult.success && historyResult.data) {
        const history: WorkoutHistory[] = historyResult.data;
        setWorkoutsHistory(history);

        const today = new Date();
        const todayWorkout = history.find((w) => {
          const workoutDate = new Date(w.date);
          return workoutDate.toDateString() === today.toDateString();
        });

        if (todayWorkout) {
          setSelectedWorkout(todayWorkout);
        }
      } else {
        setWorkoutsHistory([]);
      }
    } catch (err) {
      console.error("Error fetching workouts history:", err);
      setWorkoutsHistory([]);
    }
  }, [user?.uid]);

  // Load today's workout plan
  const loadTodayWorkout = useCallback(async () => {
    if (!user?.uid) return;

    setLoading(true);

    await checkTodayWorkout();
    await loadWorkoutsHistory();

    if (workoutPlan) {
      setWorkoutPlanName(workoutPlan.planName || "");
      const today = new Date();
      const dayName = getDayNameFromDate(today);
      const todayPlan = workoutPlan.days.find((d) => d.day === dayName);
      setTodayWorkout(todayPlan || null);
    }

    setLoading(false);
    setRefreshing(false);
  }, [
    user?.uid,
    workoutPlan,
    checkTodayWorkout,
    getDayNameFromDate,
    loadWorkoutsHistory,
  ]);

  // Handle day press in calendar
  const handleDayPress = useCallback(
    async (day: Date, index: number) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (day > today) return;

      setSelectedDay(day);
      setCurrentMonth(day);
      setSelectedWorkout(null);

      if (!user?.uid) {
        return;
      }

      try {
        let history = workoutsHistory;
        if (!history || history.length === 0) {
          const res = await getUserWorkouts(user.uid);
          if (res.success && res.data) {
            history = res.data;
            setWorkoutsHistory(history);
          } else {
            history = [];
          }
        }

        const found = history.find((w) => {
          const workoutDate = new Date(w.date);
          return workoutDate.toDateString() === day.toDateString();
        });

        if (found) {
          setSelectedWorkout(found);
        } else {
          setSelectedWorkout(null);
        }

        // Get the workout plan for the selected day based on split cycle
        const dayName = getDayNameFromDate(day);
        const planDay = workoutPlan?.days?.find((d) => d.day === dayName);
        setTodayWorkout(planDay || null);
      } catch (err) {
        console.error("[Workout] error fetching workouts for day:", err);
        setSelectedWorkout(null);
      }
    },
    [user?.uid, workoutsHistory, workoutPlan, getDayNameFromDate]
  );

  // Handle start workout
  const handleStartWorkout = useCallback(() => {
    const today = new Date();
    const isToday = selectedDay.toDateString() === today.toDateString();

    // If workout already exists today, navigate to history
    if (isToday && hasWorkoutToday) {
      router.push({
        pathname: "/(tabs)/history",
        params: {
          selectedDate: today.toISOString(),
          refresh: "true",
        },
      });
      return;
    }

    // Start new workout - this will open the addWorkout modal
    if (isToday) {
      router.push("/(modals)/addWorkout");
    }
  }, [selectedDay, hasWorkoutToday, router]);

  // Handle edit plan
  const handleEditPlan = useCallback(() => {
    router.push("/(modals)/workoutPlan");
  }, [router]);

  // Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setSelectedWorkout(null);
    loadTodayWorkout();
  }, [loadTodayWorkout]);

  // Check if a day has a workout
  const hasWorkoutOnDay = useCallback(
    (day: Date) => {
      return workoutsHistory.some((w) => {
        const workoutDate = new Date(w.date);
        return workoutDate.toDateString() === day.toDateString();
      });
    },
    [workoutsHistory]
  );

  // Handle content size change for initial scroll
  const handleContentSizeChange = useCallback(() => {
    if (initialIndex === null || didInitialScrollRef.current) return;
    if (!flashListRef.current || calendarDays.length === 0) return;

    const idx = clamp(initialIndex, 0, Math.max(0, calendarDays.length - 1));

    requestAnimationFrame(() => {
      try {
        flashListRef.current?.scrollToIndex({
          index: idx,
          animated: true,
          viewPosition: 0.5,
        });
        didInitialScrollRef.current = true;
      } catch (err) {
        try {
          flashListRef.current?.scrollToOffset({
            offset: Math.max(0, idx * ITEM_WIDTH),
            animated: true,
          });
          didInitialScrollRef.current = true;
        } catch (e) {
          console.warn("Couldn't perform initial scroll:", e);
        }
      }
    });
  }, [initialIndex, calendarDays.length]);

  // Handle scroll to update current month
  const handleScroll = useCallback(
    (event: any) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / ITEM_WIDTH);
      const clampedIndex = clamp(index, 0, calendarDays.length - 1);

      if (calendarDays[clampedIndex]) {
        setCurrentMonth(calendarDays[clampedIndex]);
      }
    },
    [calendarDays]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_WIDTH,
      offset: ITEM_WIDTH * index,
      index,
    }),
    []
  );

  const keyExtractor = useCallback(
    (item: Date, index: number) => `${item.toISOString()}-${index}`,
    []
  );

  // Render calendar day
  const renderDay = useCallback(
    ({ item: day, index }: { item: Date; index: number }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const isTodayCard = day.toDateString() === today.toDateString();
      const isSelected = day.toDateString() === selectedDay.toDateString();
      const isFuture = day > today;
      const hasWorkout = hasWorkoutOnDay(day);

      const dayOfWeek = day.getDay();
      const adjustedDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      const planDay = workoutPlan?.days?.find(
        (d) => d.day === DAYS_FULL[adjustedDayOfWeek]
      );
      const isRestDay = planDay?.isRestDay ?? false;

      return (
        <DayCard
          day={day}
          index={index}
          isTodayCard={isTodayCard}
          isSelected={isSelected}
          isRest={isRestDay}
          hasWorkoutOnDay={hasWorkout}
          hasWorkoutToday={hasWorkoutToday && isTodayCard}
          isFuture={isFuture}
          onPress={() => handleDayPress(day, index)}
        />
      );
    },
    [selectedDay, hasWorkoutToday, hasWorkoutOnDay, workoutPlan, handleDayPress]
  );

  // Render workout content based on state
  const renderContent = useCallback(() => {
    if (selectedWorkout) {
      return (
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={styles.workoutSection}
        >
          <View style={styles.sectionHeader}>
            <Typo size={20} fontWeight="600">
              {isSelectedDayToday ? "Today's Workout" : "Logged Workout"}
            </Typo>
            <View style={styles.exerciseCountBadge}>
              <Typo size={14} color={colors.neutral300}>
                {selectedWorkout.exercises?.length || 0} exercises
              </Typo>
            </View>
          </View>

          <View style={styles.workoutCard}>
            {selectedWorkout.exercises?.map((exercise, exIdx) => (
              <View key={exIdx} style={styles.exerciseItem}>
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseTitleRow}>
                    <View style={styles.exerciseIcon}>
                      <Icons.Barbell
                        size={20}
                        color={colors.primary}
                        weight="bold"
                      />
                    </View>
                    <Typo size={16} fontWeight="600">
                      {exercise.exerciseName}
                    </Typo>
                  </View>
                  <View style={styles.setCountBadge}>
                    <Typo size={12} fontWeight="600" color={colors.white}>
                      {exercise.sets?.length || 0} sets
                    </Typo>
                  </View>
                </View>

                <View style={styles.setsContainer}>
                  {exercise.sets?.map((set, setIdx) => (
                    <View key={setIdx} style={styles.setRow}>
                      <View style={styles.setNumber}>
                        <Typo
                          size={12}
                          fontWeight="600"
                          color={colors.neutral400}
                        >
                          {setIdx + 1}
                        </Typo>
                      </View>
                      <View style={styles.setInfo}>
                        <View style={styles.setDetail}>
                          <Icons.Barbell size={14} color={colors.neutral400} />
                          <Typo size={14} color={colors.white}>
                            {set.weight} {set.weightUnit}
                          </Typo>
                        </View>
                        <View style={styles.setDetail}>
                          <Icons.Repeat size={14} color={colors.neutral400} />
                          <Typo size={14} color={colors.white}>
                            {set.reps} reps
                          </Typo>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      );
    }

    if (todayWorkout && !todayWorkout.isRestDay && isSelectedDayToday) {
      return (
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={styles.workoutSection}
        >
          <View style={styles.sectionHeader}>
            <Typo size={20} fontWeight="600">
              Today's Plan
            </Typo>
            <TouchableOpacity onPress={handleEditPlan}>
              <Icons.PencilSimple size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.planCard}>
            <View style={styles.planHeader}>
              <View style={styles.planIconContainer}>
                <Icons.ListDashes
                  size={24}
                  color={colors.primary}
                  weight="bold"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Typo size={18} fontWeight="700">
                  {workoutPlanName}
                </Typo>
                <Typo size={14} color={colors.neutral400}>
                  {todayWorkout.exercises?.length || 0} exercises planned
                </Typo>
              </View>
            </View>

            <View style={styles.exercisesList}>
              {todayWorkout.exercises?.map((exercise, idx) => (
                <View key={idx} style={styles.exerciseListItem}>
                  <View style={styles.exerciseDot} />
                  <Typo size={15} color={colors.neutral200}>
                    {exercise.exerciseName}
                  </Typo>
                  <Typo size={13} color={colors.neutral500}>
                    {exercise.sets?.length || 0} sets
                  </Typo>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartWorkout}
              activeOpacity={0.8}
            >
              <Icons.Play size={20} color={colors.black} weight="fill" />
              <Typo size={16} fontWeight="700" color={colors.black}>
                Start Workout
              </Typo>
            </TouchableOpacity>
          </View>
        </Animated.View>
      );
    }

    if (todayWorkout?.isRestDay && isSelectedDayToday) {
      return (
        <View style={styles.restDayContainer}>
          <View style={styles.restDayIcon}>
            <Icons.BedIcon size={40} color={colors.primary} weight="fill" />
          </View>
          <Typo size={22} fontWeight="700" style={{ marginTop: spacingY._15 }}>
            Rest Day
          </Typo>
          <Typo
            size={15}
            color={colors.neutral400}
            style={{ marginTop: spacingY._7, textAlign: "center" }}
          >
            Recovery is part of the process
          </Typo>
        </View>
      );
    }

    if (isSelectedDayPast) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Icons.ClockCounterClockwise
              size={48}
              color={colors.neutral500}
              weight="fill"
            />
          </View>
          <Typo
            size={18}
            fontWeight="600"
            color={colors.neutral200}
            style={{ marginTop: spacingY._15, textAlign: "center" }}
          >
            No workout logged
          </Typo>
          <Typo
            size={15}
            color={colors.neutral400}
            style={{ marginTop: spacingY._7, textAlign: "center" }}
          >
            You didn't log a workout on this day
          </Typo>
        </View>
      );
    }

    if (isSelectedDayFuture) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Icons.CalendarBlank
              size={48}
              color={colors.neutral500}
              weight="fill"
            />
          </View>
          <Typo
            size={18}
            fontWeight="600"
            color={colors.neutral200}
            style={{ marginTop: spacingY._15, textAlign: "center" }}
          >
            Future date
          </Typo>
          <Typo
            size={15}
            color={colors.neutral400}
            style={{ marginTop: spacingY._7, textAlign: "center" }}
          >
            You can plan your workout when the day comes
          </Typo>
        </View>
      );
    }

    return (
      <View style={styles.noPlanContainer}>
        <View style={styles.emptyIconContainer}>
          <Icons.FileX size={48} color={colors.neutral500} weight="fill" />
        </View>
        <Typo
          size={18}
          fontWeight="600"
          color={colors.neutral200}
          style={{ marginTop: spacingY._15, textAlign: "center" }}
        >
          No workout plan
        </Typo>
        <Typo
          size={15}
          color={colors.neutral400}
          style={{ marginTop: spacingY._7, textAlign: "center" }}
        >
          Create a workout plan to get started
        </Typo>
        <TouchableOpacity style={styles.createButton} onPress={handleEditPlan}>
          <Icons.Plus size={20} color={colors.black} weight="bold" />
          <Typo size={16} fontWeight="700" color={colors.black}>
            Create Plan
          </Typo>
        </TouchableOpacity>
      </View>
    );
  }, [
    selectedWorkout,
    todayWorkout,
    isSelectedDayToday,
    isSelectedDayPast,
    isSelectedDayFuture,
    workoutPlanName,
    handleStartWorkout,
    handleEditPlan,
  ]);

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
                Workout
              </Typo>
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
          {/* Header */}
          <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
            <Typo size={28} fontWeight="700">
              Workout
            </Typo>
          </Animated.View>

          {/* Month/Year Header */}
          <Animated.View
            entering={FadeInDown.duration(400).delay(100)}
            style={styles.monthHeader}
          >
            <Typo size={20} fontWeight="600" color={colors.white}>
              {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </Typo>
            <View style={styles.statsRow}>
              <Typo size={14} color={colors.neutral400}>
                {workoutsHistory.length} workout
                {workoutsHistory.length !== 1 ? "s" : ""}
              </Typo>
            </View>
          </Animated.View>

          {/* Scrollable Calendar */}
          {calendarDays.length > 0 && (
            <Animated.View
              entering={FadeInDown.duration(400).delay(200)}
              style={styles.calendarWrapper}
            >
              <FlashList
                ref={flashListRef}
                data={calendarDays}
                renderItem={renderDay}
                keyExtractor={keyExtractor}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.calendarContainer}
                estimatedItemSize={ITEM_WIDTH}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onLoad={handleContentSizeChange}
                extraData={{ selectedDay, workoutsHistory }}
              />
            </Animated.View>
          )}

          {/* Content Section */}
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
              {renderContent()}
            </ScrollView>
          </View>
        </View>
      </ScreenWrapper>
    </SwipeableScreen>
  );
});

export default Workout;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  header: {
    paddingVertical: spacingY._15,
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
  calendarWrapper: {
    height: verticalScale(90),
    marginBottom: spacingY._15,
  },
  calendarContainer: {
    paddingHorizontal: spacingX._5,
  },
  dayCard: {
    width: DAY_WIDTH,
    marginRight: ITEM_SPACING,
    alignItems: "center",
    paddingVertical: spacingY._10,
    borderRadius: radius._12,
    backgroundColor: colors.neutral800,
  },
  dayCardSelected: {
    backgroundColor: colors.primary,
  },
  dayCardFuture: {
    opacity: 0.4,
  },
  dayNumber: {
    marginVertical: spacingY._5,
  },
  dayNumberToday: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  indicators: {
    height: verticalScale(16),
    justifyContent: "center",
    alignItems: "center",
  },
  workoutDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
  },
  workoutDotSelected: {
    backgroundColor: colors.neutral900,
  },
  contentSection: {
    flex: 1,
    marginTop: spacingY._10,
  },
  scrollContent: {
    paddingBottom: verticalScale(20),
    flexGrow: 1,
  },
  workoutSection: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._15,
  },
  exerciseCountBadge: {
    backgroundColor: colors.neutral800,
    paddingHorizontal: spacingX._12,
    paddingVertical: verticalScale(6),
    borderRadius: radius._10,
  },
  workoutCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
    gap: spacingY._20,
  },
  exerciseItem: {
    gap: spacingY._12,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exerciseTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    flex: 1,
  },
  exerciseIcon: {
    width: verticalScale(36),
    height: verticalScale(36),
    backgroundColor: colors.neutral900,
    borderRadius: radius._10,
    alignItems: "center",
    justifyContent: "center",
  },
  setCountBadge: {
    backgroundColor: colors.neutral700,
    paddingHorizontal: spacingX._10,
    paddingVertical: verticalScale(4),
    borderRadius: radius._6,
  },
  setsContainer: {
    gap: spacingY._10,
    paddingLeft: spacingX._15,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
  },
  setNumber: {
    width: verticalScale(28),
    height: verticalScale(28),
    backgroundColor: colors.neutral700,
    borderRadius: radius._6,
    alignItems: "center",
    justifyContent: "center",
  },
  setInfo: {
    flex: 1,
    flexDirection: "row",
    gap: spacingX._20,
  },
  setDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
  },
  planCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._15,
    marginBottom: spacingY._20,
  },
  planIconContainer: {
    width: verticalScale(52),
    height: verticalScale(52),
    backgroundColor: colors.neutral900,
    borderRadius: radius._15,
    alignItems: "center",
    justifyContent: "center",
  },
  exercisesList: {
    gap: spacingY._12,
    marginBottom: spacingY._20,
  },
  exerciseListItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
  },
  exerciseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._10,
    backgroundColor: colors.primary,
    paddingVertical: spacingY._15,
    borderRadius: radius._15,
    borderWidth: 0,
    overflow: "hidden",
  },
  restDayContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacingY._50,
  },
  restDayIcon: {
    width: verticalScale(80),
    height: verticalScale(80),
    borderRadius: 40,
    backgroundColor: colors.neutral800,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.primary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacingY._50,
    paddingHorizontal: spacingX._30,
  },
  emptyIconContainer: {
    width: verticalScale(80),
    height: verticalScale(80),
    borderRadius: 40,
    backgroundColor: colors.neutral800,
    alignItems: "center",
    justifyContent: "center",
  },
  noPlanContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacingY._50,
    paddingHorizontal: spacingX._30,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._10,
    backgroundColor: colors.primary,
    paddingVertical: spacingY._15,
    paddingHorizontal: spacingX._30,
    borderRadius: radius._15,
    marginTop: spacingY._20,
    borderWidth: 0,
    overflow: "hidden",
  },
});
