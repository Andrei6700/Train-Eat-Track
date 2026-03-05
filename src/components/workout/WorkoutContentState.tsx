import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Typo from "@/src/components/ui/Typo";
import { DayWorkout, WorkoutHistory, WorkoutPlan } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Icons from "phosphor-react-native";

export type WorkoutContentStateProps = {
  selectedWorkout: WorkoutHistory | null;
  selectedPlanDay: DayWorkout | null;
  workoutPlan: WorkoutPlan | null;
  workoutPlanName: string;
  isSelectedDayToday: boolean;
  isSelectedDayPast: boolean;
  isSelectedDayFuture: boolean;
  shouldShowLogButton: boolean;
  onStartWorkout: () => void;
  onEditPlan: () => void;
  onLogWorkout: () => void;
};

const WorkoutContentState = ({
  selectedWorkout,
  selectedPlanDay,
  workoutPlan,
  workoutPlanName,
  isSelectedDayToday,
  isSelectedDayPast,
  isSelectedDayFuture,
  shouldShowLogButton,
  onStartWorkout,
  onEditPlan,
  onLogWorkout,
}: WorkoutContentStateProps) => {
  if (selectedWorkout) {
    return (
      <Animated.View
        entering={FadeInDown.duration(400).delay(200)}
        style={styles.workoutSection}
      >
        <View style={styles.sectionHeader}>
          <Typo size={20} fontWeight="600">
            {isSelectedDayToday ? "Today\u2019s Workout" : "Logged Workout"}
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
                      <Typo size={12} fontWeight="600" color={colors.neutral400}>
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

  if (selectedPlanDay?.isRestDay) {
    return (
      <View style={styles.restDayContainer}>
        <View style={styles.restDayIcon}>
          <Icons.BedIcon size={40} color={colors.primary} weight="fill" />
        </View>
        <Typo size={22} fontWeight="700" style={styles.restDayTitle}>
          Rest Day
        </Typo>
        <Typo size={15} color={colors.neutral400} style={styles.restDaySubtitle}>
          Recovery is part of the process
        </Typo>
      </View>
    );
  }

  if (workoutPlan && isSelectedDayToday) {
    const hasExercises =
      !!selectedPlanDay?.exercises && selectedPlanDay.exercises.length > 0;

    return (
      <Animated.View
        entering={FadeInDown.duration(400).delay(200)}
        style={styles.workoutSection}
      >
        <View style={styles.sectionHeader}>
          <Typo size={20} fontWeight="600">
            {"Today's Plan"}
          </Typo>
          <TouchableOpacity onPress={onEditPlan}>
            <Icons.PencilSimple size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <View style={styles.planIconContainer}>
              <Icons.ListDashes size={24} color={colors.primary} weight="bold" />
            </View>
            <View style={styles.planHeaderTextContainer}>
              <Typo size={18} fontWeight="700">
                {workoutPlanName}
              </Typo>
              <Typo size={14} color={colors.neutral400}>
                {hasExercises
                  ? `${selectedPlanDay?.exercises.length || 0} exercises planned`
                  : "Continue your training cycle"}
              </Typo>
            </View>
          </View>

          {hasExercises && (
            <View style={styles.exercisesList}>
              {selectedPlanDay?.exercises.map((exercise, idx) => (
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
          )}

          {!hasExercises && (
            <View style={styles.infoBox}>
              <Icons.Info size={16} color={colors.primary} weight="fill" />
              <Typo size={13} color={colors.neutral300} style={styles.infoText}>
                Your exercises from previous workouts will be loaded automatically
              </Typo>
            </View>
          )}

          <TouchableOpacity
            style={styles.startButton}
            onPress={onStartWorkout}
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

  if (shouldShowLogButton) {
    return (
      <Animated.View
        entering={FadeInDown.duration(400).delay(200)}
        style={styles.emptyContainer}
      >
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
          style={styles.emptyTitle}
        >
          No workout logged
        </Typo>
        <Typo size={15} color={colors.neutral400} style={styles.emptySubtitle}>
          Forgot to log your workout that day?
        </Typo>

        <TouchableOpacity
          style={styles.logPastButton}
          onPress={onLogWorkout}
          activeOpacity={0.8}
        >
          <Icons.Plus size={20} color={colors.black} weight="bold" />
          <Typo size={16} fontWeight="700" color={colors.black}>
            Log Workout for This Day
          </Typo>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (isSelectedDayPast) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Icons.CalendarBlank size={48} color={colors.neutral500} weight="fill" />
        </View>
        <Typo
          size={18}
          fontWeight="600"
          color={colors.neutral200}
          style={styles.emptyTitle}
        >
          No workout logged
        </Typo>
        <Typo size={15} color={colors.neutral400} style={styles.emptyBody}>
          {selectedPlanDay?.isRestDay
            ? "This was a rest day"
            : "You can only log workouts from your first training day onwards"}
        </Typo>
      </View>
    );
  }

  if (isSelectedDayFuture) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Icons.CalendarBlank size={48} color={colors.neutral500} weight="fill" />
        </View>
        <Typo
          size={18}
          fontWeight="600"
          color={colors.neutral200}
          style={styles.emptyTitle}
        >
          Future date
        </Typo>
        <Typo size={15} color={colors.neutral400} style={styles.emptyBody}>
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
        style={styles.emptyTitle}
      >
        No workout plan
      </Typo>
      <Typo size={15} color={colors.neutral400} style={styles.emptyBody}>
        Create a workout plan to get started
      </Typo>
      <TouchableOpacity style={styles.createButton} onPress={onEditPlan}>
        <Icons.Plus size={20} color={colors.black} weight="bold" />
        <Typo size={16} fontWeight="700" color={colors.black}>
          Create Plan
        </Typo>
      </TouchableOpacity>
    </View>
  );
};

export default React.memo(WorkoutContentState);

const styles = StyleSheet.create({
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
    gap: spacingY._15,
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
  planHeaderTextContainer: {
    flex: 1,
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
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral900,
    borderRadius: radius._10,
    padding: spacingY._12,
    marginBottom: spacingY._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  infoText: {
    flex: 1,
    marginLeft: spacingX._10,
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
  restDayTitle: {
    marginTop: spacingY._15,
  },
  restDaySubtitle: {
    marginTop: spacingY._7,
    textAlign: "center",
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
  emptyTitle: {
    marginTop: spacingY._15,
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: spacingY._7,
    textAlign: "center",
    marginBottom: spacingY._20,
  },
  emptyBody: {
    marginTop: spacingY._7,
    textAlign: "center",
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
  logPastButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._10,
    backgroundColor: colors.primary,
    paddingVertical: spacingY._15,
    paddingHorizontal: spacingX._25,
    borderRadius: radius._15,
    borderWidth: 0,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
});
