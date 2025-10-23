import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import Loading from "@/src/components/ui/Loading";
import Typo from "@/src/components/ui/Typo";
import WorkoutCard from "@/src/components/ui/WorkoutCard";
import { useAuth } from "@/src/contexts/authContext";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import { getUserWorkouts } from "@/src/services/workoutService";
import { WorkoutHistory } from "@/src/types/index";
import { scale, verticalScale } from "@/src/utils/styling";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  FlatList,
} from "react-native";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS_FULL = ["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"];

const DAY_WIDTH = scale(50);

const History = () => {
  const { user } = useAuth();
  const { workoutPlan } = useWorkoutPlan();
  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const flatListRef = useRef<FlatList>(null);

  const { refresh } = useLocalSearchParams();
  const router = useRouter();

  const fetchWorkoutsHistory = async () => {
    if (!user?.uid) return;

    try {
      const result = await getUserWorkouts(user.uid);
      if (result.success) {
        setWorkoutsHistory(result.data || []);
      } else {
        console.error("Error fetching workouts:", result.msg);
      }
    } catch (error) {
      console.error("Error fetching workouts history:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const generateCalendarDays = () => {
    if (workoutsHistory.length === 0) {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const days: Date[] = [];
      for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }
      
      setCalendarDays(days);
      return;
    }

    const workoutDates = workoutsHistory.map(w => new Date(w.date));
    const firstWorkoutDate = new Date(Math.min(...workoutDates.map(d => d.getTime())));
    const today = new Date();

    const startDate = new Date(firstWorkoutDate.getFullYear(), firstWorkoutDate.getMonth(), 1);
    
    const days: Date[] = [];
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    setCalendarDays(days);

    setTimeout(() => {
      const todayIndex = days.findIndex(
        d => d.toDateString() === today.toDateString()
      );
      if (todayIndex !== -1 && flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index: todayIndex,
          animated: true,
          viewPosition: 0.5
        });
      }
    }, 100);
  };

  useFocusEffect(
    useCallback(() => {
      if (refresh === "true") {
        setIsRefreshing(true);
        fetchWorkoutsHistory();
        router.setParams({ refresh: undefined });
      }
    }, [refresh])
  );

  useEffect(() => {
    fetchWorkoutsHistory();
  }, [user?.uid]);

  useEffect(() => {
    if (!isLoading) {
      generateCalendarDays();
    }
  }, [workoutsHistory, isLoading]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchWorkoutsHistory();
  };

  const handlePlus = () => {
    if (!workoutPlan) {
      router.push("/(modals)/workoutPlan");
    } else {
      router.push("/(modals)/addWorkout");
    }
  };

  const hasWorkoutOnDate = (date: Date) => {
    return workoutsHistory.some(
      w => new Date(w.date).toDateString() === date.toDateString()
    );
  };

  const getWorkoutForDate = (date: Date): WorkoutHistory | null => {
    return workoutsHistory.find(
      w => new Date(w.date).toDateString() === date.toDateString()
    ) || null;
  };

  const isRestDay = (date: Date): boolean => {
    if (!workoutPlan) return false;
    
    const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
    const dayName = DAYS_FULL[dayIndex];
    const planDay = workoutPlan.days?.find(d => d.day === dayName);
    
    return planDay?.isRestDay || false;
  };

  const handleDayPress = (date: Date) => {
    setSelectedDate(date);
    setCurrentMonth(date);
  };

  const selectedWorkout = getWorkoutForDate(selectedDate);

  const renderDay = ({ item: date, index }: { item: Date; index: number }) => {
    const isSelected = date.toDateString() === selectedDate.toDateString();
    const isToday = date.toDateString() === new Date().toDateString();
    const hasWorkout = hasWorkoutOnDate(date);
    const isRest = isRestDay(date);

    return (
      <TouchableOpacity
        style={[
          styles.dayCard,
          isToday && styles.dayCardToday,
          isSelected && styles.dayCardSelected,
          isRest && styles.dayCardRest,
        ]}
        onPress={() => handleDayPress(date)}
        activeOpacity={0.7}
      >
        <Typo
          size={12}
          color={
            isRest 
              ? colors.rose
              : isToday || isSelected 
              ? colors.white 
              : colors.neutral400
          }
          style={{ marginBottom: verticalScale(4) }}
        >
          {date.toLocaleDateString("en-US", { weekday: "short" })}
        </Typo>
        <Typo
          size={16}
          fontWeight="600"
          color={
            isRest
              ? colors.rose
              : isToday || isSelected 
              ? colors.white 
              : colors.text
          }
        >
          {date.getDate()}
        </Typo>
        {hasWorkout && (
          <View style={styles.workoutIndicator} />
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <ScreenWrapper>
        <View style={styles.container}>
          <Header title="History" style={{ marginVertical: spacingY._10 }} />
        </View>
        <Loading />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header title="History" style={{ marginVertical: spacingY._10 }} />

        {/* Month/Year Header */}
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

        {/* Scrollable Calendar */}
        {calendarDays.length > 0 && (
          <FlatList
            ref={flatListRef}
            data={calendarDays}
            renderItem={renderDay}
            keyExtractor={(item) => item.toISOString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.calendarContainer}
            style={styles.calendar}
            getItemLayout={(data, index) => ({
              length: DAY_WIDTH,
              offset: DAY_WIDTH * index,
              index,
            })}
            onScroll={(e) => {
              const offsetX = e.nativeEvent.contentOffset.x;
              const index = Math.round(offsetX / DAY_WIDTH);
              if (calendarDays[index]) {
                setCurrentMonth(calendarDays[index]);
              }
            }}
            scrollEventThrottle={16}
          />
        )}

        <TouchableOpacity style={styles.floatingButton} onPress={handlePlus}>
          <Icons.PlusIcon size={28} color={colors.black} weight="bold" />
        </TouchableOpacity>

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
          {selectedWorkout ? (
            <View style={styles.selectedWorkoutSection}>
              <Typo size={18} fontWeight="600" style={{ marginBottom: spacingY._15 }}>
                Workout on {selectedDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </Typo>
              <WorkoutCard workout={selectedWorkout} />
            </View>
          ) : isRestDay(selectedDate) ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Icons.BedIcon
                  size={48}
                  color={colors.rose}
                  weight="fill"
                />
              </View>
              <Typo
                size={20}
                fontWeight="600"
                color={colors.neutral200}
                style={{ textAlign: "center", marginTop: spacingY._15 }}
              >
                Rest Day
              </Typo>
              <Typo
                size={15}
                color={colors.neutral400}
                style={{ textAlign: "center", marginTop: spacingY._10 }}
              >
                Recovery is just as important as training
              </Typo>
            </View>
          ) : calendarDays.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Icons.BarbellIcon
                  size={64}
                  color={colors.neutral500}
                  weight="fill"
                />
              </View>
              <Typo
                size={20}
                fontWeight="600"
                color={colors.neutral200}
                style={{ textAlign: "center", marginTop: spacingY._15 }}
              >
                No workouts logged yet
              </Typo>
              <Typo
                size={15}
                color={colors.neutral400}
                style={{ textAlign: "center", marginTop: spacingY._10 }}
              >
                Start training to see your history here!
              </Typo>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Icons.CalendarBlankIcon
                  size={48}
                  color={colors.neutral500}
                  weight="fill"
                />
              </View>
              <Typo
                size={18}
                fontWeight="600"
                color={colors.neutral200}
                style={{ textAlign: "center", marginTop: spacingY._15 }}
              >
                No workout on this day
              </Typo>
              <Typo
                size={15}
                color={colors.neutral400}
                style={{ textAlign: "center", marginTop: spacingY._10 }}
              >
                Select another day or add a new workout
              </Typo>
            </View>
          )}
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
};

export default History;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  monthHeader: {
    marginBottom: spacingY._10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  calendar: {
    marginBottom: spacingY._15,
  },
  calendarContainer: {
    paddingVertical: spacingY._10,
    gap: spacingX._10,
  },
  dayCard: {
    alignItems: "center",
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(8),
    borderRadius: radius._12,
    backgroundColor: colors.neutral800,
    minWidth: scale(50),
    height: verticalScale(75),
    justifyContent: "center",
    position: "relative",
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
    borderWidth: 2,
    borderColor: colors.rose,
  },
  workoutIndicator: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  scrollViewContent: {
    paddingBottom: scale(300),
  },
  selectedWorkoutSection: {
    marginTop: spacingY._10,
  },
  emptyState: {
    marginTop: verticalScale(60),
    alignItems: "center",
    paddingHorizontal: spacingX._30,
  },
  emptyIconContainer: {
    backgroundColor: colors.neutral800,
    padding: spacingX._25,
    borderRadius: 100,
  },
  floatingButton: {
    position: "absolute",
    right: 24,
    bottom: 110,
    zIndex: 10,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});