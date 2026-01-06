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
import { useFocusEffect, useLocalSearchParams } from "expo-router";
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
  const flatListRef = useRef<FlatList>(null);
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

    // Calculăm mâine pentru a-l include în calendar (vizual)
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Dacă nu avem workout-uri, generăm doar luna curentă până la mâine
    if (workoutsHistory.length === 0) {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

      const days: Date[] = [];
      // Generăm până la mâine (inclusiv) pentru vizualizare
      for (let d = new Date(firstDay); d <= tomorrow; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }

      setCalendarDays(days);

      const targetDate = paramDate ? new Date(paramDate as string) : today;
      // Asigură-te că targetDate nu e în viitor (doar azi poate fi selectat maxim)
      const safeTargetDate = targetDate > today ? today : targetDate;
      const found = days.findIndex(d => d.toDateString() === safeTargetDate.toDateString());
      const safeIndex = found !== -1 ? found : days.length - 2; // -2 pentru a selecta azi, nu mâine
      setInitialIndex(safeIndex);
      setSelectedDate(days[safeIndex] || today);
      setCurrentMonth(days[safeIndex] || today);
      return;
    }

    // Găsim data celui mai vechi workout
    const workoutDates = workoutsHistory.map(w => new Date(w.date));
    const firstWorkoutDate = new Date(Math.min(...workoutDates.map(d => d.getTime())));
    firstWorkoutDate.setHours(0, 0, 0, 0);

    // Calculăm startDate - prima zi a lunii celui mai vechi workout
    const startDate = new Date(firstWorkoutDate.getFullYear(), firstWorkoutDate.getMonth(), 1);

    // Calculăm endDate - mâine (pentru vizualizare)
    const endDate = new Date(tomorrow);

    const days: Date[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    setCalendarDays(days);

    // Determinăm indexul pentru scroll
    const targetDate = paramDate ? new Date(paramDate as string) : today;
    // Asigură-te că targetDate nu e în viitor
    const safeTargetDate = targetDate > today ? today : targetDate;
    let foundIndex = days.findIndex(d => d.toDateString() === safeTargetDate.toDateString());
    
    if (foundIndex === -1) {
      // Dacă targetDate nu e în range, scroll la azi
      foundIndex = days.findIndex(d => d.toDateString() === today.toDateString());
      if (foundIndex === -1) {
        foundIndex = days.length - 2; // Penultima zi (azi)
      }
    }
    
    const safeIndex = clamp(foundIndex, 0, days.length - 1);
    setInitialIndex(safeIndex);
    setSelectedDate(days[safeIndex]);
    setCurrentMonth(days[safeIndex]);
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
        // Nu permite selectarea unei date din viitor
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
    if (!flatListRef.current || calendarDays.length === 0) return;

    const idx = clamp(initialIndex, 0, Math.max(0, calendarDays.length - 1));
    
    requestAnimationFrame(() => {
      try {
        flatListRef.current?.scrollToIndex({
          index: idx,
          animated: true,
          viewPosition: 0.5,
        });
        didInitialScrollRef.current = true;
      } catch (err) {
        try {
          flatListRef.current?.scrollToOffset({
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

  const hasWorkoutOnDate = useCallback((date: Date) => {
    return workoutsHistory.some(
      w => new Date(w.date).toDateString() === date.toDateString()
    );
  }, [workoutsHistory]);

  const getWorkoutForDate = useCallback((date: Date): WorkoutHistory | null => {
    return workoutsHistory.find(
      w => new Date(w.date).toDateString() === date.toDateString()
    ) || null;
  }, [workoutsHistory]);

  const isRestDay = useCallback((date: Date): boolean => {
    if (!workoutPlan) return false;

    const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
    const dayName = DAYS_FULL[dayIndex];
    const planDay = workoutPlan.days?.find(d => d.day === dayName);

    return planDay?.isRestDay || false;
  }, [workoutPlan]);

  // Verifică dacă data este în viitor (după azi)
  const isFutureDate = useCallback((date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate > today;
  }, []);

  const handleDayPress = useCallback((date: Date) => {
    // Nu permite selectarea zilelor din viitor
    if (isFutureDate(date)) {
      return;
    }
    setSelectedDate(date);
    setCurrentMonth(date);
  }, [isFutureDate]);

  const selectedWorkout = getWorkoutForDate(selectedDate);

  const renderDay = useCallback(({ item: date, index }: { item: Date; index: number }) => {
    const isSelected = date.toDateString() === selectedDate.toDateString();
    const isToday = date.toDateString() === new Date().toDateString();
    const hasWorkout = hasWorkoutOnDate(date);
    const isRest = isRestDay(date);
    const isFuture = isFutureDate(date);

    return (
      <TouchableOpacity
        style={[
          styles.dayCard,
          isToday && styles.dayCardToday,
          isSelected && !isFuture && styles.dayCardSelected,
          isRest && !isToday && !isSelected && !isFuture && styles.dayCardRest,
          isFuture && styles.dayCardFuture,
        ]}
        onPress={() => handleDayPress(date)}
        activeOpacity={isFuture ? 1 : 0.7}
        disabled={isFuture}
      >
        <Typo
          size={12}
          color={
            isFuture
              ? colors.neutral600
              : isRest && !isToday && !isSelected
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
            isFuture
              ? colors.neutral600
              : isRest && !isToday && !isSelected
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
  }, [selectedDate, hasWorkoutOnDate, isRestDay, handleDayPress, isFutureDate]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_WIDTH,
    offset: ITEM_WIDTH * index,
    index,
  }), []);

  const handleScroll = useCallback((e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / ITEM_WIDTH);
    if (calendarDays[index]) {
      setCurrentMonth(calendarDays[index]);
    }
  }, [calendarDays]);

  const keyExtractor = useCallback((item: Date) => item.toISOString(), []);

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
            keyExtractor={keyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.calendarContainer}
            style={styles.calendar}
            getItemLayout={getItemLayout}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            initialNumToRender={14}
            maxToRenderPerBatch={14}
            windowSize={7}
            onContentSizeChange={handleContentSizeChange}
            snapToInterval={ITEM_WIDTH}
            decelerationRate="fast"
            removeClippedSubviews={true}
          />
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
                <Typo size={18} fontWeight="600" style={styles.sectionTitle}>
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
                  <Icons.Bed
                    size={48}
                    color={colors.rose}
                    weight="fill"
                  />
                </View>
                <Typo
                  size={20}
                  fontWeight="600"
                  color={colors.neutral200}
                  style={styles.emptyTitle}
                >
                  Rest Day
                </Typo>
                <Typo
                  size={15}
                  color={colors.neutral400}
                  style={styles.emptySubtitle}
                >
                  Recovery is just as important as training
                </Typo>
              </View>
            ) : calendarDays.length === 0 ? (
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
                  Select another day to view workouts
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
    flexGrow: 0,
    flexShrink: 0,
  },
  calendarContainer: {
    paddingVertical: spacingY._5,
    paddingRight: spacingX._20,
  },
  dayCard: {
    alignItems: "center",
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(8),
    borderRadius: radius._12,
    backgroundColor: colors.neutral800,
    width: DAY_WIDTH,
    height: verticalScale(75),
    justifyContent: "center",
    position: "relative",
    marginRight: ITEM_SPACING,
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
  dayCardFuture: {
    backgroundColor: colors.neutral900,
    opacity: 0.5,
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