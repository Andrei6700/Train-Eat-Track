import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import SwipeableScreen from "@/src/components/layout/SwipeableScreen";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { getUserWorkouts } from "@/src/services/workoutService";
import { WorkoutHistory } from "@/src/types/index";
import { scale, verticalScale } from "@/src/utils/styling";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";

type PeriodType = "Weekly" | "Monthly" | "Yearly";

type ChartDataPoint = {
  value: number;
  label: string;
  dataPointText?: string;
};

type ExerciseStats = {
  exerciseName: string;
  totalWeight: number;
  maxWeight: number;
  totalReps: number;
  averageTopSetReps: number;
  workoutCount: number;
  dates: Date[];
  weights: number[];
  reps: number[];
};

const getPeriodStartDate = (period: PeriodType): Date => {
  const periodStart = new Date();
  periodStart.setHours(0, 0, 0, 0);

  if (period === "Weekly") {
    periodStart.setDate(periodStart.getDate() - 7);
  } else if (period === "Monthly") {
    periodStart.setMonth(periodStart.getMonth() - 1);
  } else {
    periodStart.setFullYear(periodStart.getFullYear() - 1);
  }

  return periodStart;
};

const Statistics = () => {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("Monthly");
  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const [availableExercises, setAvailableExercises] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [exerciseStats, setExerciseStats] = useState<ExerciseStats | null>(
    null
  );
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);

  const [weightChartData, setWeightChartData] = useState<ChartDataPoint[]>([]);
  const [repsChartData, setRepsChartData] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    fetchWorkoutsHistory();
  }, [user?.uid]);

  useEffect(() => {
    extractExercises();
  }, [workoutsHistory, selectedPeriod]);

  useEffect(() => {
    if (selectedExercise && workoutsHistory.length > 0) {
      generateExerciseStats();
      return;
    }

    setExerciseStats(null);
    setWeightChartData([]);
    setRepsChartData([]);
  }, [selectedExercise, selectedPeriod, workoutsHistory]);

  const fetchWorkoutsHistory = async () => {
    if (!user?.uid) return;

    try {
      const result = await getUserWorkouts(user.uid);
      if (result.success) {
        setWorkoutsHistory(result.data || []);
      }
    } catch (error) {
      console.error("Error fetching workouts:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredWorkouts = (period: PeriodType): WorkoutHistory[] => {
    const periodStart = getPeriodStartDate(period);

    return workoutsHistory.filter(
      (workout) => !workout.isRestDay && new Date(workout.date) >= periodStart
    );
  };

  const extractExercises = () => {
    const exerciseSet = new Set<string>();
    const sourceWorkouts =
      selectedPeriod === "Weekly"
        ? getFilteredWorkouts("Weekly")
        : workoutsHistory.filter((workout) => !workout.isRestDay);

    sourceWorkouts.forEach((workout) => {
      workout.exercises?.forEach((exercise) => {
        if (exercise.exerciseName) {
          exerciseSet.add(exercise.exerciseName);
        }
      });
    });

    const exercises = Array.from(exerciseSet).sort();
    setAvailableExercises(exercises);

    if (exercises.length === 0) {
      setSelectedExercise("");
      setShowExerciseSelector(false);
      return;
    }

    const selectedExerciseExists = exercises.some(
      (exerciseName) =>
        exerciseName.toLowerCase() === selectedExercise.toLowerCase()
    );

    if (!selectedExerciseExists) {
      setSelectedExercise(exercises[0]);
    }
  };

  const generateExerciseStats = () => {
    if (!selectedExercise) return;
    const filteredWorkouts = getFilteredWorkouts(selectedPeriod);

    filteredWorkouts.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const dates: Date[] = [];
    const weights: number[] = [];
    const reps: number[] = [];
    let totalWeight = 0;
    let maxWeight = 0;
    let totalReps = 0;
    let totalTopSetReps = 0;
    let workoutCount = 0;

    filteredWorkouts.forEach((workout) => {
      const exercise = workout.exercises?.find(
        (ex) => ex.exerciseName.toLowerCase() === selectedExercise.toLowerCase()
      );

      if (exercise) {
        workoutCount++;
        const workoutDate = new Date(workout.date);

        let maxWeightThisWorkout = 0;
        let repsAtMaxWeightThisWorkout = 0;
        let totalWeightThisWorkout = 0;

        exercise.sets.forEach((set) => {
          const weight =
            set.weightUnit === "lbs" ? set.weight * 0.453592 : set.weight;

          if (weight > maxWeightThisWorkout) {
            maxWeightThisWorkout = weight;
            repsAtMaxWeightThisWorkout = set.reps;
          } else if (
            weight === maxWeightThisWorkout &&
            set.reps > repsAtMaxWeightThisWorkout
          ) {
            repsAtMaxWeightThisWorkout = set.reps;
          }

          totalWeightThisWorkout += weight * set.reps;
          totalReps += set.reps;
        });

        dates.push(workoutDate);
        weights.push(Math.round(maxWeightThisWorkout * 10) / 10);
        reps.push(repsAtMaxWeightThisWorkout);
        totalWeight += totalWeightThisWorkout;
        totalTopSetReps += repsAtMaxWeightThisWorkout;

        if (maxWeightThisWorkout > maxWeight) {
          maxWeight = maxWeightThisWorkout;
        }
      }
    });

    setExerciseStats({
      exerciseName: selectedExercise,
      totalWeight: Math.round(totalWeight),
      maxWeight: Math.round(maxWeight * 10) / 10,
      totalReps,
      averageTopSetReps:
        workoutCount > 0 ? Math.round(totalTopSetReps / workoutCount) : 0,
      workoutCount,
      dates,
      weights,
      reps,
    });

    generateChartData(dates, weights, reps);
  };

  const generateChartData = (
    dates: Date[],
    weights: number[],
    reps: number[]
  ) => {
    const weightData: ChartDataPoint[] = [];
    const repsData: ChartDataPoint[] = [];

    dates.forEach((date, index) => {
      const label = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      weightData.push({
        value: weights[index],
        label: label,
        dataPointText: `${weights[index]}kg`,
      });

      repsData.push({
        value: reps[index],
        label: label,
        dataPointText: `${reps[index]}`,
      });
    });

    setWeightChartData(weightData);
    setRepsChartData(repsData);
  };

  const handleSegmentChange = (index: number) => {
    const periods: PeriodType[] = ["Weekly", "Monthly", "Yearly"];
    setSelectedPeriod(periods[index]);
  };

  const getTotalWorkouts = () => {
    return getFilteredWorkouts(selectedPeriod).length;
  };

  const getTotalTime = () => {
    return getFilteredWorkouts(selectedPeriod).reduce(
      (sum, workout) => sum + Math.floor(workout.duration / 60),
      0,
    );
  };

  const hasAnyWorkoutHistory = workoutsHistory.some(
    (workout) => !workout.isRestDay
  );

  return (
    <SwipeableScreen>
    <ScreenWrapper>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Typo size={28} fontWeight="700">
            Statistics
          </Typo>
        </View>

        <View style={styles.segmentedContainer}>
          <SegmentedControl
            values={["Weekly", "Monthly", "Yearly"]}
            selectedIndex={
              selectedPeriod === "Weekly"
                ? 0
                : selectedPeriod === "Monthly"
                ? 1
                : 2
            }
            onChange={(event) =>
              handleSegmentChange(event.nativeEvent.selectedSegmentIndex)
            }
            style={styles.segmentedControl}
            backgroundColor={colors.neutral800}
            tintColor={colors.primary}
            fontStyle={{
              color: colors.neutral400,
              fontSize: verticalScale(14),
              fontWeight: "600",
            }}
            activeFontStyle={{
              color: colors.black,
              fontSize: verticalScale(14),
              fontWeight: "700",
            }}
          />
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Icons.BarbellIcon size={24} color={colors.primary} weight="fill" />
            <Typo
              size={28}
              fontWeight="700"
              color={colors.white}
              style={{ marginTop: spacingY._7 }}
            >
              {getTotalWorkouts()}
            </Typo>
            <Typo size={13} color={colors.neutral400}>
              Workouts
            </Typo>
          </View>

          <View style={styles.statCard}>
            <Icons.TimerIcon size={24} color={colors.green} weight="fill" />
            <Typo
              size={28}
              fontWeight="700"
              color={colors.white}
              style={{ marginTop: spacingY._7 }}
            >
              {getTotalTime()}
            </Typo>
            <Typo size={13} color={colors.neutral400}>
              Minutes
            </Typo>
          </View>
        </View>

        {availableExercises.length > 0 && (
          <View style={styles.exerciseSelectorContainer}>
            <TouchableOpacity
              style={styles.exerciseSelectorButton}
              onPress={() => setShowExerciseSelector(!showExerciseSelector)}
            >
              <View style={styles.exerciseSelectorLeft}>
                <Icons.ChartLineIcon
                  size={20}
                  color={colors.primary}
                  weight="fill"
                />
                <Typo size={16} fontWeight="600" color={colors.white}>
                  {selectedExercise || "Select Exercise"}
                </Typo>
              </View>
              <Icons.CaretDownIcon
                size={20}
                color={colors.neutral400}
                style={{
                  transform: [
                    { rotate: showExerciseSelector ? "180deg" : "0deg" },
                  ],
                }}
              />
            </TouchableOpacity>

            {showExerciseSelector && (
              <View style={styles.exerciseDropdown}>
                <ScrollView
                  style={styles.exerciseList}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  {availableExercises.map((exercise, index) => (
                    <TouchableOpacity
                      key={`${exercise}-${index}`}
                      style={[
                        styles.exerciseItem,
                        selectedExercise === exercise &&
                          styles.exerciseItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedExercise(exercise);
                        setShowExerciseSelector(false);
                      }}
                    >
                      <Typo
                        size={15}
                        fontWeight={
                          selectedExercise === exercise ? "600" : "400"
                        }
                        color={
                          selectedExercise === exercise
                            ? colors.primary
                            : colors.white
                        }
                      >
                        {exercise}
                      </Typo>
                      {selectedExercise === exercise && (
                        <Icons.CheckIcon
                          size={18}
                          color={colors.primary}
                          weight="bold"
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {exerciseStats && exerciseStats.workoutCount > 0 && (
          <>
            <View style={styles.exerciseStatsContainer}>
              <View style={styles.exerciseStatCard}>
                <Icons.TrendUpIcon
                  size={24}
                  color={colors.primary}
                  weight="fill"
                />
                <Typo
                  size={24}
                  fontWeight="700"
                  color={colors.white}
                  style={{ marginTop: spacingY._7 }}
                >
                  {exerciseStats.maxWeight} kg
                </Typo>
                <Typo size={13} color={colors.neutral400}>
                  Max Weight
                </Typo>
              </View>

              <View style={styles.exerciseStatCard}>
                <Icons.HashIcon size={24} color={colors.green} weight="fill" />
                <Typo
                  size={24}
                  fontWeight="700"
                  color={colors.white}
                  style={{ marginTop: spacingY._7 }}
                >
                  {exerciseStats.totalReps}
                </Typo>
                <Typo size={13} color={colors.neutral400}>
                  Total Reps
                </Typo>
              </View>

              <View style={styles.exerciseStatCard}>
                <Icons.ScalesIcon size={24} color={"#B413BF"} weight="fill" />
                <Typo
                  size={24}
                  fontWeight="700"
                  color={colors.white}
                  style={{ marginTop: spacingY._7 }}
                >
                  {exerciseStats.totalWeight}
                </Typo>
                <Typo size={13} color={colors.neutral400}>
                  Total KG
                </Typo>
              </View>
            </View>

            {weightChartData.length > 0 && (
              <View style={styles.chartContainer}>
                <View style={styles.chartHeader}>
                  <Typo size={18} fontWeight="600">
                    Weight Progress
                  </Typo>
                  <View style={styles.chartBadge}>
                    <Typo size={13} color={colors.white}>
                      {exerciseStats.workoutCount} sessions
                    </Typo>
                  </View>
                </View>

                <LineChart
                  data={weightChartData}
                  width={scale(320)}
                  height={verticalScale(200)}
                  spacing={scale(50)}
                  thickness={3}
                  color={colors.primary}
                  startFillColor={colors.primary}
                  endFillColor={colors.primary}
                  startOpacity={0.3}
                  endOpacity={0.1}
                  initialSpacing={20}
                  noOfSections={4}
                  yAxisTextStyle={{
                    color: colors.neutral400,
                    fontSize: verticalScale(12),
                  }}
                  xAxisLabelTextStyle={{
                    color: colors.neutral400,
                    fontSize: verticalScale(11),
                  }}
                  hideRules
                  curved
                  areaChart
                  hideDataPoints={false}
                  dataPointsColor={colors.primary}
                  dataPointsRadius={4}
                  textShiftY={-8}
                  textShiftX={-5}
                  textFontSize={11}
                  textColor={colors.white}
                />
              </View>
            )}

            {repsChartData.length > 0 && (
              <View style={styles.chartContainer}>
                <View style={styles.chartHeader}>
                  <Typo size={18} fontWeight="600">
                    Reps Progress
                  </Typo>
                  <View style={styles.chartBadge}>
                    <Typo size={13} color={colors.white}>
                      Avg at max kg: {exerciseStats.averageTopSetReps} reps
                    </Typo>
                  </View>
                </View>

                <LineChart
                  data={repsChartData}
                  width={scale(320)}
                  height={verticalScale(200)}
                  spacing={scale(50)}
                  thickness={3}
                  color={colors.green}
                  startFillColor={colors.green}
                  endFillColor={colors.green}
                  startOpacity={0.3}
                  endOpacity={0.1}
                  initialSpacing={20}
                  noOfSections={4}
                  yAxisTextStyle={{
                    color: colors.neutral400,
                    fontSize: verticalScale(12),
                  }}
                  xAxisLabelTextStyle={{
                    color: colors.neutral400,
                    fontSize: verticalScale(11),
                  }}
                  hideRules
                  curved
                  areaChart
                  hideDataPoints={false}
                  dataPointsColor={colors.green}
                  dataPointsRadius={4}
                  textShiftY={-8}
                  textShiftX={-5}
                  textFontSize={11}
                  textColor={colors.white}
                />
              </View>
            )}
          </>
        )}

        {exerciseStats && exerciseStats.workoutCount === 0 && (
          <View style={styles.emptyState}>
            <Icons.ChartLineIcon
              size={48}
              color={colors.neutral500}
              weight="fill"
            />
            <Typo
              size={18}
              fontWeight="600"
              color={colors.neutral200}
              style={{ marginTop: spacingY._15 }}
            >
              No data for this period
            </Typo>
            <Typo
              size={14}
              color={colors.neutral400}
              style={{ marginTop: spacingY._7, textAlign: "center" }}
            >
              Train {selectedExercise} to see your progress
            </Typo>
          </View>
        )}

        {availableExercises.length === 0 && (
          <View style={styles.emptyState}>
            <Icons.BarbellIcon
              size={48}
              color={colors.neutral500}
              weight="fill"
            />
            <Typo
              size={18}
              fontWeight="600"
              color={colors.neutral200}
              style={{ marginTop: spacingY._15 }}
            >
              {selectedPeriod === "Weekly" && hasAnyWorkoutHistory
                ? "No workouts this week"
                : "No workouts yet"}
            </Typo>
            <Typo
              size={14}
              color={colors.neutral400}
              style={{ marginTop: spacingY._7, textAlign: "center" }}
            >
              {selectedPeriod === "Weekly" && hasAnyWorkoutHistory
                ? "Log workouts this week to see weekly statistics"
                : "Start training to see your statistics"}
            </Typo>
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
    </SwipeableScreen>
  );
};

export default Statistics;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  header: {
    paddingVertical: spacingY._15,
    alignItems: "center",
  },
  segmentedContainer: {
    marginBottom: spacingY._20,
  },
  segmentedControl: {
    height: verticalScale(45),
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacingY._20,
    gap: spacingX._10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  exerciseSelectorContainer: {
    marginBottom: spacingY._20,
  },
  exerciseSelectorButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    padding: spacingX._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  exerciseSelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  exerciseDropdown: {
    marginTop: spacingY._10,
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
    maxHeight: verticalScale(300),
    overflow: "hidden",
  },
  exerciseList: {
    maxHeight: verticalScale(300),
    padding: spacingX._10,
  },
  exerciseItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._15,
    borderRadius: radius._12,
  },
  exerciseItemSelected: {
    backgroundColor: colors.neutral700,
  },
  exerciseStatsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacingY._20,
    gap: spacingX._7,
  },
  exerciseStatCard: {
    flex: 1,
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    padding: spacingX._12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  chartContainer: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    marginBottom: spacingY._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._15,
  },
  chartBadge: {
    backgroundColor: colors.neutral700,
    paddingHorizontal: spacingX._12,
    paddingVertical: verticalScale(4),
    borderRadius: radius._10,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacingY._50,
  },
});
