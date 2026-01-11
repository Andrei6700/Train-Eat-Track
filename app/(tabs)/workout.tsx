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
import { useFocusEffect, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DayCard = React.memo(
  ({
    day,
    index,
    isTodayCard,
    isSelected,
    isRest,
    hasWorkoutOnDay,
    hasWorkoutToday,
    onPress,
  }: any) => (
    <TouchableOpacity
      style={[
        styles.dayCard,
        isTodayCard && styles.dayCardToday,
        isSelected && styles.dayCardSelected,
        isRest && styles.dayCardRest,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isTodayCard && hasWorkoutToday && (
        <View style={styles.completedIndicator}>
          <Icons.CheckCircle size={16} color={colors.green} weight="fill" />
        </View>
      )}

      {!isTodayCard && hasWorkoutOnDay && (
        <View style={styles.completedIndicator}>
          <Icons.CheckCircle size={16} color={colors.green} weight="fill" />
        </View>
      )}

      <Typo
        size={12}
        color={
          isTodayCard || isSelected || isRest ? colors.white : colors.neutral400
        }
        style={{ marginBottom: verticalScale(4) }}
      >
        {DAYS_SHORT[index]}
      </Typo>
      <Typo
        size={16}
        fontWeight="600"
        color={isTodayCard || isSelected || isRest ? colors.white : colors.text}
      >
        {day.getDate()}
      </Typo>
    </TouchableOpacity>
  )
);

const Workout = React.memo(() => {
  const router = useRouter();
  const { user } = useAuth();
  const { workoutPlan } = useWorkoutPlan();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentWeek, setCurrentWeek] = useState<Date[]>([]);
  const [todayIndex, setTodayIndex] = useState(0);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [todayWorkout, setTodayWorkout] = useState<DayWorkout | null>(null);
  const [workoutPlanName, setWorkoutPlanName] = useState("");
  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutHistory | null>(
    null
  );
  const [hasWorkoutToday, setHasWorkoutToday] = useState(false);

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

  /**
   * Calculate which day index in the split cycle a given date corresponds to
   * This is the core function for split days functionality
   */
  const getDayIndexFromDate = useCallback(
    (date: Date): number => {
      if (!workoutPlan || !workoutPlan.splitDays) {
        // Fallback to weekly schedule if no split is defined
        return date.getDay() === 0 ? 6 : date.getDay() - 1;
      }

      // Handle both Firestore Timestamp and Date objects
      let planCreatedDate: Date;
      if (workoutPlan.createdAt && typeof workoutPlan.createdAt === 'object' && 'toDate' in workoutPlan.createdAt) {
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

  /**
   * Get the day name (e.g., "Day 1") for a given date based on split cycle
   */
  const getDayNameFromDate = useCallback(
    (date: Date): string => {
      const dayIndex = getDayIndexFromDate(date);
      return `Day ${dayIndex + 1}`;
    },
    [getDayIndexFromDate]
  );

  useFocusEffect(
    useCallback(() => {
      const today = new Date();
      setSelectedDay(today);
      setSelectedWorkout(null);

      if (user?.uid) {
        checkTodayWorkout();
        loadWorkoutsHistory();
      }

      if (currentWeek.length > 0) {
        const todayIdx = currentWeek.findIndex(
          (d) => d.toDateString() === today.toDateString()
        );
        if (todayIdx !== -1) {
          setTodayIndex(todayIdx);
        }
      }

      loadTodayWorkout();

      return () => {};
    }, [currentWeek, user?.uid])
  );

  useEffect(() => {
    generateWeek();
    loadTodayWorkout();
  }, [user?.uid, workoutPlan]);

  useEffect(() => {
    if (workoutPlan === null) {
      setTodayWorkout(null);
      setWorkoutPlanName("");
    }
  }, [workoutPlan]);

  const generateWeek = useCallback(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      week.push(day);
    }

    setCurrentWeek(week);

    const todayIdx = week.findIndex(
      (d) => d.toDateString() === today.toDateString()
    );
    setTodayIndex(todayIdx !== -1 ? todayIdx : 0);
    setSelectedDay(today);
  }, []);

  const checkTodayWorkout = useCallback(async () => {
    if (!user?.uid) return;

    const existsCheck = await checkWorkoutExistsToday(user.uid);
    setHasWorkoutToday(existsCheck.data?.exists || false);
  }, [user?.uid]);

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

  const handleDayPress = useCallback(
    async (day: Date, index: number) => {
      setSelectedDay(day);
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

  /**
   * FIXED: Handle start workout with proper split days functionality
   * This now correctly routes to addWorkout modal when starting a workout
   */
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
    // The addWorkout modal will handle loading the correct exercises for today's split
    if (isToday) {
      router.push("/(modals)/addWorkout");
    }
  }, [selectedDay, hasWorkoutToday, router]);

  const handleEditPlan = useCallback(() => {
    router.push("/(modals)/workoutPlan");
  }, [router]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setSelectedWorkout(null);
    loadTodayWorkout();
  }, [loadTodayWorkout]);

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

          {selectedWorkout.exercises?.map((exercise, index) => (
            <View key={index} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <Typo size={16} fontWeight="600">
                  {exercise.exerciseName}
                </Typo>
                <Typo size={14} color={colors.neutral400}>
                  {exercise.sets?.length || 0} sets
                </Typo>
              </View>
              <View style={styles.setsContainer}>
                {exercise.sets?.map((set, setIndex) => (
                  <View key={setIndex} style={styles.setRowCompact}>
                    <View style={styles.setNumberSmall}>
                      <Typo
                        size={12}
                        fontWeight="600"
                        color={colors.neutral300}
                      >
                        {setIndex + 1}
                      </Typo>
                    </View>
                    <Typo size={14} color={colors.neutral200}>
                      {set.reps} reps × {set.weight} {set.weightUnit}
                    </Typo>
                  </View>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.startButton}
            onPress={() =>
              router.push({
                pathname: "/workoutDetail",
                params: { workoutId: selectedWorkout.id },
              })
            }
          >
            <Icons.Eye size={24} color={colors.black} weight="fill" />
            <Typo size={18} fontWeight="700" color={colors.black}>
              View Details
            </Typo>
          </TouchableOpacity>
        </Animated.View>
      );
    }

    if (todayWorkout && !todayWorkout.isRestDay) {
      return (
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={styles.workoutSection}
        >
          <View style={styles.sectionHeader}>
            <Typo size={20} fontWeight="600">
              {isSelectedDayToday ? "Today's Workout" : "Planned Workout"}
            </Typo>
            <View style={styles.exerciseCountBadge}>
              <Typo size={14} color={colors.neutral300}>
                {todayWorkout.exercises?.length || 0} exercises
              </Typo>
            </View>
          </View>

          {todayWorkout.exercises?.map((exercise, index) => (
            <View key={index} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <Typo size={16} fontWeight="600">
                  {exercise.exerciseName}
                </Typo>
                <Typo size={14} color={colors.neutral400}>
                  {exercise.sets?.length || 0} sets
                </Typo>
              </View>
              <View style={styles.setsContainer}>
                {exercise.sets?.map((set, setIndex) => (
                  <View key={setIndex} style={styles.setRowCompact}>
                    <View style={styles.setNumberSmall}>
                      <Typo
                        size={12}
                        fontWeight="600"
                        color={colors.neutral300}
                      >
                        {setIndex + 1}
                      </Typo>
                    </View>
                    <Typo size={14} color={colors.neutral200}>
                      {set.reps} reps × {set.weight} {set.weightUnit}
                    </Typo>
                  </View>
                ))}
              </View>
            </View>
          ))}

          {isSelectedDayToday ? (
            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartWorkout}
            >
              <Icons.Play size={24} color={colors.black} weight="fill" />
              <Typo size={18} fontWeight="700" color={colors.black}>
                {hasWorkoutToday ? "View in History" : "Start Workout"}
              </Typo>
            </TouchableOpacity>
          ) : isSelectedDayPast ? (
            <View style={styles.pastDayMessage}>
              <Icons.CalendarBlank size={24} color={colors.neutral500} />
              <Typo
                size={14}
                color={colors.neutral400}
                style={{ marginLeft: spacingX._10 }}
              >
                No workout was logged on this day
              </Typo>
            </View>
          ) : (
            <View style={styles.futureDayMessage}>
              <Icons.Clock size={24} color={colors.primary} />
              <Typo
                size={14}
                color={colors.neutral400}
                style={{ marginLeft: spacingX._10 }}
              >
                Scheduled for{" "}
                {selectedDay.toLocaleDateString("en-US", { weekday: "long" })}
              </Typo>
            </View>
          )}
        </Animated.View>
      );
    }

    if (todayWorkout?.isRestDay) {
      return (
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={styles.restDayContainer}
        >
          <View style={styles.restDayIcon}>
            <Icons.Bed size={48} color={colors.primary} weight="fill" />
          </View>
          <Typo size={24} fontWeight="600" style={{ marginTop: spacingY._15 }}>
            Rest Day
          </Typo>
          <Typo
            size={16}
            color={colors.neutral400}
            style={{ marginTop: spacingY._7, textAlign: "center" }}
          >
            Recovery is just as important as training
          </Typo>
        </Animated.View>
      );
    }

    if (isSelectedDayPast) {
      return (
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={styles.noWorkoutContainer}
        >
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
            No workout logged on this day
          </Typo>
          <Typo
            size={15}
            color={colors.neutral400}
            style={{ marginTop: spacingY._7, textAlign: "center" }}
          >
            This day has passed
          </Typo>
        </Animated.View>
      );
    }

    if (isSelectedDayFuture) {
      return (
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={styles.noWorkoutContainer}
        >
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
            Future Day
          </Typo>
          <Typo
            size={15}
            color={colors.neutral400}
            style={{ marginTop: spacingY._7, textAlign: "center" }}
          >
            {workoutPlan
              ? "No workout planned for this day"
              : "Create a workout plan to schedule workouts"}
          </Typo>
        </Animated.View>
      );
    }

    return (
      <Animated.View
        entering={FadeInDown.duration(400).delay(200)}
        style={styles.noWorkoutContainer}
      >
        <TouchableOpacity
          style={styles.addButton}
          onPress={workoutPlan ? handleStartWorkout : handleEditPlan}
        >
          <Icons.PlusCircle size={32} color={colors.primary} weight="fill" />
          <Typo
            size={16}
            fontWeight="600"
            color={colors.primary}
            style={{ marginTop: spacingY._10 }}
          >
            {workoutPlan ? "Start Workout" : "Create Workout Plan"}
          </Typo>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [
    selectedWorkout,
    todayWorkout,
    isSelectedDayToday,
    isSelectedDayPast,
    isSelectedDayFuture,
    hasWorkoutToday,
    workoutPlan,
  ]);

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.container}>
          <View style={styles.header}>
            <Typo size={28} fontWeight="700">
              Today
            </Typo>
          </View>
        </View>
        <Loading />
      </ScreenWrapper>
    );
  }

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
          <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
            <Typo size={28} fontWeight="700">
              {workoutPlanName || "Workout"}
            </Typo>
            {workoutPlan && (
              <TouchableOpacity onPress={handleEditPlan}>
                <Icons.Pencil size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(400).delay(100)}
            style={styles.weekContainer}
          >
            {currentWeek.map((day, index) => {
              const isTodayCard = index === todayIndex;
              const isSelected =
                day.toDateString() === selectedDay.toDateString();

              const dayName = getDayNameFromDate(day);
              const planDay = workoutPlan?.days?.find((d) => d.day === dayName);
              const isRest = !!planDay?.isRestDay;

              const hasWorkoutOnDay = workoutsHistory.some(
                (w) => new Date(w.date).toDateString() === day.toDateString()
              );

              return (
                <DayCard
                  key={index}
                  day={day}
                  index={index}
                  isTodayCard={isTodayCard}
                  isSelected={isSelected}
                  isRest={isRest}
                  hasWorkoutOnDay={hasWorkoutOnDay}
                  hasWorkoutToday={hasWorkoutToday}
                  onPress={() => handleDayPress(day, index)}
                />
              );
            })}
          </Animated.View>

          {renderContent()}
        </ScrollView>
      </ScreenWrapper>
    </SwipeableScreen>
  );
});

Workout.displayName = "Workout";

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
  weekContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacingY._20,
    paddingVertical: spacingY._10,
  },
  dayCard: {
    alignItems: "center",
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(8),
    borderRadius: radius._12,
    backgroundColor: colors.neutral800,
    borderWidth: 1,
    borderColor: colors.neutral700,
    position: "relative",
  },
  dayCardToday: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  dayCardRest: {
    backgroundColor: colors.neutral700,
    borderColor: colors.neutral600,
  },
  completedIndicator: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: colors.neutral900,
    borderRadius: 10,
    padding: 2,
  },
  workoutSection: {
    gap: spacingY._15,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._10,
  },
  exerciseCountBadge: {
    backgroundColor: colors.neutral800,
    paddingHorizontal: spacingX._12,
    paddingVertical: verticalScale(4),
    borderRadius: radius._10,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  exerciseCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    padding: spacingX._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._12,
  },
  setsContainer: {
    gap: spacingY._7,
  },
  setRowCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  setNumberSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.neutral700,
    alignItems: "center",
    justifyContent: "center",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._10,
    backgroundColor: colors.primary,
    paddingVertical: spacingY._15,
    borderRadius: radius._17,
    marginTop: spacingY._10,
  },
  restDayContainer: {
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
  noWorkoutContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacingY._50,
  },
  emptyIconContainer: {
    width: verticalScale(80),
    height: verticalScale(80),
    borderRadius: 40,
    backgroundColor: colors.neutral800,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacingX._20,
  },
  pastDayMessage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacingY._20,
    paddingHorizontal: spacingX._20,
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    marginTop: spacingY._10,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  futureDayMessage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacingY._20,
    paddingHorizontal: spacingX._20,
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    marginTop: spacingY._10,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
});