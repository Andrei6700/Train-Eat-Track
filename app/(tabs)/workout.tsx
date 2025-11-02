import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import Loading from "@/src/components/ui/Loading";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { checkWorkoutExistsToday, getUserWorkouts } from "@/src/services/workoutService";
import { DayWorkout, WorkoutHistory } from "@/src/types/index";
import { scale, verticalScale } from "@/src/utils/styling";
import { useFocusEffect, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL = ["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"];

const Workout = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { workoutPlan } = useWorkoutPlan();
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState<Date[]>([]);
  const [todayIndex, setTodayIndex] = useState(0);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [todayWorkout, setTodayWorkout] = useState<DayWorkout | null>(null);
  const [workoutPlanName, setWorkoutPlanName] = useState("");
  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutHistory | null>(null);
  const [hasWorkoutToday, setHasWorkoutToday] = useState(false);

    useFocusEffect(
    useCallback(() => {
      const today = new Date();
      setSelectedDay(today);
      
      if (user?.uid) {
        checkTodayWorkout();
      }
      
      if (currentWeek.length > 0) {
        const todayIdx = currentWeek.findIndex((d) => d.toDateString() === today.toDateString());
        if (todayIdx !== -1) {
          setTodayIndex(todayIdx);
        }
      }
      
      // Reîncarcă datele când revii pe tab
      loadTodayWorkout();
      
      return () => {};
    }, [currentWeek, user?.uid])
  );

  useEffect(() => {
    generateWeek();
    loadTodayWorkout();
  }, [user?.uid, workoutPlan]);
  
  // Resetează workout-ul zilei când planul e șters
  useEffect(() => {
    if (workoutPlan === null) {
      setTodayWorkout(null);
      setWorkoutPlanName("");
    }
  }, [workoutPlan]);
  
  useFocusEffect(
    useCallback(() => {
      const today = new Date();
      setSelectedDay(today);
      
      if (user?.uid) {
        checkTodayWorkout();
      }
      
      if (currentWeek.length > 0) {
        const todayIdx = currentWeek.findIndex((d) => d.toDateString() === today.toDateString());
        if (todayIdx !== -1) {
          setTodayIndex(todayIdx);
        }
      }
      
      return () => {};
    }, [currentWeek, user?.uid])
  );

  useEffect(() => {
    generateWeek();
    loadTodayWorkout();
  }, [user?.uid, workoutPlan]);

  const generateWeek = () => {
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

    const todayIdx = week.findIndex((d) => d.toDateString() === today.toDateString());
    setTodayIndex(todayIdx !== -1 ? todayIdx : 0);
    setSelectedDay(today);
  };

  const checkTodayWorkout = async () => {
    if (!user?.uid) return;
    
    const existsCheck = await checkWorkoutExistsToday(user.uid);
    setHasWorkoutToday(existsCheck.data?.exists || false);
  };

  const checkWorkoutOnDay = async (date: Date) => {
    if (!user?.uid) return false;
    
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
        return workoutDate.toDateString() === date.toDateString();
      });

      return !!found;
    } catch (err) {
      console.error("[Workout] error checking workout for day:", err);
      return false;
    }
  };

  const loadTodayWorkout = async () => {
    if (!user?.uid) return;

    setLoading(true);

    await checkTodayWorkout();

    if (workoutPlan) {
      setWorkoutPlanName(workoutPlan.planName || "");
      const today = new Date();
      const dayName = DAYS_FULL[today.getDay() === 0 ? 6 : today.getDay() - 1];
      const todayPlan = workoutPlan.days.find((d) => d.day === dayName);
      setTodayWorkout(todayPlan || null);
    }

    try {
      const historyResult = await getUserWorkouts(user.uid);
      if (historyResult.success && historyResult.data) {
        const history: WorkoutHistory[] = historyResult.data;
        setWorkoutsHistory(history);
      } else {
        setWorkoutsHistory([]);
      }
    } catch (err) {
      console.error("Error fetching workouts history:", err);
      setWorkoutsHistory([]);
    }

    setLoading(false);
  };

  const handleDayPress = async (day: Date, index: number) => {
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

      const dayName = DAYS_FULL[index];
      const planDay = workoutPlan?.days?.find((d) => d.day === dayName);
      setTodayWorkout(planDay || null);
    } catch (err) {
      console.error("[Workout] error fetching workouts for day:", err);
      setSelectedWorkout(null);
    }
  };

  const handleStartWorkout = () => {
    const today = new Date();
    const isToday = selectedDay.toDateString() === today.toDateString();
    
    if (isToday && hasWorkoutToday) {
      router.push({
        pathname: "/(tabs)/history",
        params: { 
          selectedDate: today.toISOString(),
          refresh: "true" 
        }
      });
      return;
    }
    
    if (isToday) {
      router.push("/(modals)/addWorkout");
    }
  };

  const isPastDay = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDay);
    selected.setHours(0, 0, 0, 0);
    return selected < today;
  };

  const handleEditPlan = () => {
    router.push("/(modals)/workoutPlan");
  };

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

  const isToday = selectedDay.toDateString() === new Date().toDateString();

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Typo size={28} fontWeight="700">
            {workoutPlanName || "Workout"}
          </Typo>
          {/* ✅ FIX: Afișează creionul DOAR dacă există un plan */}
          {workoutPlan && (
            <TouchableOpacity onPress={handleEditPlan}>
              <Icons.PencilIcon size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Week Calendar */}
        <View style={styles.weekContainer}>
          {currentWeek.map((day, index) => {
            const isTodayCard = index === todayIndex;
            const isSelected = day.toDateString() === selectedDay.toDateString();

            const dayName = DAYS_FULL[index];
            const planDay = workoutPlan?.days?.find((d) => d.day === dayName);
            const isRest = !!planDay?.isRestDay;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCard,
                  isTodayCard && styles.dayCardToday,
                  isSelected && styles.dayCardSelected,
                  isRest && styles.dayCardRest,
                ]}
                onPress={() => handleDayPress(day, index)}
                activeOpacity={0.7}
              >
                {isTodayCard && hasWorkoutToday && (
                  <View style={styles.completedIndicator}>
                    <Icons.CheckCircleIcon size={16} color={colors.green} weight="fill" />
                  </View>
                )}
                
                <Typo
                  size={12}
                  color={isTodayCard || isSelected || isRest ? colors.white : colors.neutral400}
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
            );
          })}
        </View>

        {/* Content based on selected day */}
        {selectedWorkout ? (
          <View style={styles.workoutSection}>
            <View style={styles.sectionHeader}>
              <Typo size={20} fontWeight="600">
                {isToday ? "Today's Workout" : "Logged Workout"}
              </Typo>
              <View style={styles.exerciseCountBadge}>
                <Typo size={14} color={colors.white}>
                  {selectedWorkout.exercises.length} exercises
                </Typo>
              </View>
            </View>

            {selectedWorkout.exercises.map((exercise, index) => (
              <View key={index} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <Typo size={17} fontWeight="600">
                    {exercise.exerciseName}
                  </Typo>
                  <Typo size={14} color={colors.neutral400}>
                    {exercise.sets.length} sets
                  </Typo>
                </View>

                <View style={styles.setsContainer}>
                  {exercise.sets.map((set, setIndex) => (
                    <View key={setIndex} style={styles.setRowCompact}>
                      <View style={styles.setNumberSmall}>
                        <Typo size={12} color={colors.neutral400}>
                          {setIndex + 1}
                        </Typo>
                      </View>
                      <Typo size={14} color={colors.white}>
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
              <Icons.EyeIcon size={24} color={colors.black} weight="fill" />
              <Typo size={18} fontWeight="700" color={colors.black}>
                View Details
              </Typo>
            </TouchableOpacity>
          </View>
        ) : todayWorkout && !todayWorkout.isRestDay ? (
          <View style={styles.workoutSection}>
            <View style={styles.sectionHeader}>
              <Typo size={20} fontWeight="600">
                {isToday ? "Today's Workout" : "Planned Workout"}
              </Typo>
              <View style={styles.exerciseCountBadge}>
                <Typo size={14} color={colors.white}>
                  {todayWorkout.exercises.length} exercises
                </Typo>
              </View>
            </View>

            {todayWorkout.exercises.map((exercise, index) => (
              <View key={index} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <Typo size={17} fontWeight="600">
                    {exercise.exerciseName}
                  </Typo>
                  <Typo size={14} color={colors.neutral400}>
                    {exercise.sets.length} sets
                  </Typo>
                </View>

                <View style={styles.setsContainer}>
                  {exercise.sets.map((set, setIndex) => (
                    <View key={setIndex} style={styles.setRowCompact}>
                      <View style={styles.setNumberSmall}>
                        <Typo size={12} color={colors.neutral400}>
                          {setIndex + 1}
                        </Typo>
                      </View>
                      <Typo size={14} color={colors.white}>
                        {set.reps} reps × {set.weight} {set.weightUnit}
                      </Typo>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {isToday ? (
              <TouchableOpacity style={styles.startButton} onPress={handleStartWorkout}>
                <Icons.PlayIcon size={24} color={colors.black} weight="fill" />
                <Typo size={18} fontWeight="700" color={colors.black}>
                  {hasWorkoutToday ? "View in History" : "Start Workout"}
                </Typo>
              </TouchableOpacity>
            ) : isPastDay() ? (
              <View style={styles.noWorkoutContainer}>
                <View style={styles.emptyIconContainer}>
                  <Icons.CalendarBlankIcon size={48} color={colors.neutral500} weight="fill" />
                </View>
                <Typo size={18} fontWeight="600" color={colors.neutral200} style={{ marginTop: spacingY._15, textAlign: "center" }}>
                  No workout logged on this day
                </Typo>
                <Typo size={15} color={colors.neutral400} style={{ marginTop: spacingY._7, textAlign: "center" }}>
                  This day has passed
                </Typo>
              </View>
            ) : (
              <TouchableOpacity style={styles.startButton} onPress={handleStartWorkout}>
                <Icons.PlayIcon size={24} color={colors.black} weight="fill" />
                <Typo size={18} fontWeight="700" color={colors.black}>
                  Start Workout
                </Typo>
              </TouchableOpacity>
            )}
          </View>
        ) : todayWorkout?.isRestDay ? (
          <View style={styles.restDayContainer}>
            <View style={styles.restDayIcon}>
              <Icons.BedIcon size={48} color={colors.primary} weight="fill" />
            </View>
            <Typo size={24} fontWeight="600" style={{ marginTop: spacingY._15 }}>
              Rest Day
            </Typo>
            <Typo size={16} color={colors.neutral400} style={{ marginTop: spacingY._7 }}>
              Recovery is just as important as training
            </Typo>
          </View>
        ) : isPastDay() ? (
          <View style={styles.noWorkoutContainer}>
            <View style={styles.emptyIconContainer}>
              <Icons.CalendarBlankIcon size={48} color={colors.neutral500} weight="fill" />
            </View>
            <Typo size={18} fontWeight="600" color={colors.neutral200} style={{ marginTop: spacingY._15, textAlign: "center" }}>
              No workout logged on this day
            </Typo>
            <Typo size={15} color={colors.neutral400} style={{ marginTop: spacingY._7, textAlign: "center" }}>
              This day has passed
            </Typo>
          </View>
        ) : (
          <View style={styles.noWorkoutContainer}>
            <TouchableOpacity style={styles.addButton} onPress={handleEditPlan}>
              <Typo size={16} color={colors.neutral400}>
                + Add Workout Plan
              </Typo>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
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
    minWidth: scale(45),
    position: 'relative',
  },
  dayCardToday: {
    backgroundColor: colors.primary,
  },
  dayCardSelected: {
    backgroundColor: colors.neutral700,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  dayCardRest: {
    backgroundColor: "#FFD54F",
  },
  completedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
  },
  workoutSection: {
    marginBottom: spacingY._30,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._15,
  },
  exerciseCountBadge: {
    backgroundColor: colors.neutral700,
    paddingHorizontal: spacingX._12,
    paddingVertical: verticalScale(4),
    borderRadius: radius._10,
  },
  exerciseCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    padding: spacingX._15,
    marginBottom: spacingY._12,
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
    width: verticalScale(24),
    height: verticalScale(24),
    borderRadius: 100,
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
    borderRadius: radius._17,
    paddingVertical: spacingY._17,
    marginTop: spacingY._15,
  },
  restDayContainer: {
    alignItems: "center",
    paddingVertical: spacingY._50,
  },
  restDayIcon: {
    backgroundColor: colors.neutral800,
    padding: spacingX._25,
    borderRadius: 100,
  },
  noWorkoutContainer: {
    paddingTop: spacingY._30,
    alignItems: "center",
  },
  emptyIconContainer: {
    backgroundColor: colors.neutral800,
    padding: spacingX._25,
    borderRadius: 100,
  },
  addButton: {
    borderWidth: 2,
    borderColor: colors.neutral600,
    borderStyle: "dashed",
    borderRadius: radius._17,
    paddingVertical: spacingY._35,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral800,
    width: "100%",
  },
});