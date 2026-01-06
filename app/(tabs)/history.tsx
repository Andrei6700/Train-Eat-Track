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
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS_FULL = ["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"];

const DAY_WIDTH = scale(50);
const ITEM_SPACING = scale(8);
const ITEM_WIDTH = DAY_WIDTH + ITEM_SPACING;

const History = () => {
  const { user } = useAuth();
  const { workoutPlan } = useWorkoutPlan();
  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [initialIndex, setInitialIndex] = useState<number | null>(null);
  const flashListRef = useRef<FlashList<Date>>(null);
  const didInitialScrollRef = useRef(false);

  const { refresh, selectedDate: paramDate } = useLocalSearchParams();

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

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  const generateCalendarDays = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (workoutsHistory.length === 0) {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

      const days: Date[] = [];
      for (let d = new Date(firstDay); d <= tomorrow; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }

      setCalendarDays(days);

      const targetDate = paramDate ? new Date(paramDate as string) : today;
      const safeTargetDate = targetDate > today ? today : targetDate;

      const safeIndex = days.findIndex(
        (d) => d.toDateString() === safeTargetDate.toDateString()
      );
      setInitialIndex(safeIndex !== -1 ? safeIndex : days.length - 2);
      setSelectedDate(days[safeIndex !== -1 ? safeIndex : days.length - 2]);
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
    for (let d = new Date(firstDay); d <= tomorrow; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    setCalendarDays(days);

    const targetDate = paramDate ? new Date(paramDate as string) : today;
    const safeTargetDate = targetDate > today ? today : targetDate;
    const safeIndex = days.findIndex(
      (d) => d.toDateString() === safeTargetDate.toDateString()
    );
    setInitialIndex(safeIndex !== -1 ? safeIndex : days.length - 2);
    setSelectedDate(days[safeIndex !== -1 ? safeIndex : days.length - 2]);
    setCurrentMonth(days[safeIndex !== -1 ? safeIndex : days.length - 2]);
  }, [workoutsHistory, paramDate]);

  useFocusEffect(
    useCallback(() => {
      if (refresh === "true") {
        setIsRefreshing(true);
        fetchWorkoutsHistory();
      }

      if (paramDate) {
        const dateFromParam = new Date(paramDate as string);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const safeDate = dateFromParam > today ? today : dateFromParam;
        setSelectedDate(safeDate);
        setCurrentMonth(safeDate);
      }
    }, [refresh, paramDate])
  );

  useEffect(() => {
    fetchWorkoutsHistory();
  }, [user?.uid]);

  useEffect(() => {
    if (!isLoading) {
      didInitialScrollRef.current = false;
      generateCalendarDays();
    }
  }, [workoutsHistory, isLoading, generateCalendarDays]);

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

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchWorkoutsHistory();
  }, [user?.uid]);

  const handleScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / ITEM_WIDTH);
    const clampedIndex = clamp(index, 0, calendarDays.length - 1);
    
    if (calendarDays[clampedIndex]) {
      setCurrentMonth(calendarDays[clampedIndex]);
    }
  }, [calendarDays]);

  const selectedWorkout = workoutsHistory.find(
    (w) => new Date(w.date).toDateString() === selectedDate.toDateString()
  );

  const hasAnyWorkouts = workoutsHistory.length > 0;

  const handleDayPress = useCallback((day: Date, index: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (day > today) return;
    
    setSelectedDate(day);
    setCurrentMonth(day);
  }, []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_WIDTH,
    offset: ITEM_WIDTH * index,
    index,
  }), []);

  const keyExtractor = useCallback((item: Date, index: number) => 
    `${item.toISOString()}-${index}`, []);

  const renderDay = useCallback(({ item: day, index }: { item: Date; index: number }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isToday = day.toDateString() === today.toDateString();
    const isSelected = day.toDateString() === selectedDate.toDateString();
    const isFuture = day > today;

    const hasWorkout = workoutsHistory.some(
      (w) => new Date(w.date).toDateString() === day.toDateString()
    );

    const dayOfWeek = day.getDay();
    const adjustedDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const dayName = DAYS_FULL[adjustedDayOfWeek].substring(0, 3);

    const planDay = workoutPlan?.days?.find(
      (d) => d.day === DAYS_FULL[adjustedDayOfWeek]
    );
    const isRestDay = planDay?.isRestDay ?? false;

    return (
      <TouchableOpacity
        onPress={() => handleDayPress(day, index)}
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
          {dayName}
        </Typo>

        <View
          style={[
            styles.dayNumber,
            isToday && !isSelected && styles.dayNumberToday,
          ]}
        >
          <Typo
            size={18}
            fontWeight={isSelected || isToday ? "700" : "500"}
            color={
              isFuture
                ? colors.neutral600
                : isSelected
                ? colors.black
                : isToday
                ? colors.primary
                : colors.white
            }
          >
            {day.getDate()}
          </Typo>
        </View>

        <View style={styles.indicators}>
          {hasWorkout && (
            <View
              style={[
                styles.workoutDot,
                isSelected && styles.workoutDotSelected,
              ]}
            />
          )}
          {isRestDay && !hasWorkout && (
            <Icons.Coffee
              size={12}
              color={isSelected ? colors.neutral700 : colors.neutral500}
              weight="fill"
            />
          )}
        </View>
      </TouchableOpacity>
    );
  }, [selectedDate, workoutsHistory, workoutPlan, handleDayPress]);

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

        {/* Scrollable Calendar cu FlashList */}
        {calendarDays.length > 0 && (
          <View style={styles.calendarWrapper}>
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
              extraData={{ selectedDate, workoutsHistory }}
            />
          </View>
        )}

        {/* Content Section */}
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
            {/* Selected Workout Display */}
            {selectedWorkout ? (
              <View style={styles.selectedWorkoutSection}>
                <Typo
                  size={18}
                  fontWeight="600"
                  color={colors.neutral200}
                  style={styles.sectionTitle}
                >
                  Workout Details
                </Typo>
                <WorkoutCard
                  workout={selectedWorkout}
                  showDate={false}
                  onRefresh={() => {
                    setIsRefreshing(true);
                    fetchWorkoutsHistory();
                  }}
                />
              </View>
            ) : !hasAnyWorkouts ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Icons.Barbell
                    size={64}
                    color={colors.neutral500}
                    weight="fill"
                  />
                </View>
                <Typo
                  size={20}
                  fontWeight="600"
                  color={colors.neutral200}
                  style={styles.emptyTitle}
                >
                  No workouts logged yet
                </Typo>
                <Typo
                  size={15}
                  color={colors.neutral400}
                  style={styles.emptySubtitle}
                >
                  Start training to see your history here!
                </Typo>
              </View>
            ) : (
              <View style={styles.emptyState}>
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
                  style={styles.emptyTitle}
                >
                  No workout on this day
                </Typo>
                <Typo
                  size={15}
                  color={colors.neutral400}
                  style={styles.emptySubtitle}
                >
                  Select another day or start a new workout
                </Typo>
              </View>
            )}
          </ScrollView>
        </View>
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
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: verticalScale(20),
  },
  selectedWorkoutSection: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: spacingY._15,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: verticalScale(60),
    paddingHorizontal: spacingX._30,
  },
  emptyIconContainer: {
    backgroundColor: colors.neutral800,
    padding: spacingX._25,
    borderRadius: 100,
  },
  emptyTitle: {
    textAlign: "center",
    marginTop: spacingY._15,
  },
  emptySubtitle: {
    textAlign: "center",
    marginTop: spacingY._10,
  },
});