import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { WorkoutHistory } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { formatDuration } from "@/src/utils/utils";
import { CaretRight, Timer } from "phosphor-react-native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Typo from "./Typo";

type RecentWorkoutRowProps = {
  workout: WorkoutHistory;
  workoutDateLabel: string;
  moreCountLabel?: string;
  onPress: (workoutId: string) => void;
};

const RecentWorkoutRow = React.memo(
  ({ workout, workoutDateLabel, moreCountLabel, onPress }: RecentWorkoutRowProps) => {
    const handlePress = () => {
      if (!workout.id) return;
      onPress(workout.id);
    };

    return (
      <View style={styles.outer}>
        <View style={styles.shadowLayer} />
        <Pressable style={({ pressed }) => [styles.workoutItem, pressed && styles.pressed]} onPress={handlePress}>
          <View style={styles.workoutLeft}>
            <View style={styles.workoutDate}>
              <Typo size={15} fontWeight="700" color={colors.white}>
                {workoutDateLabel}
              </Typo>
              <View style={styles.workoutMeta}>
                <Timer size={14} color={colors.white} weight="fill" />
                <Typo size={13} variant="mono" color={colors.white}>
                  {formatDuration(workout.duration)}
                </Typo>
              </View>
            </View>

            <View style={styles.workoutExercises}>
              {workout.exercises.slice(0, 2).map((exercise, index) => (
                <Typo
                  key={`${workout.id ?? workoutDateLabel}-${index}-${exercise.exerciseName}`}
                  size={13}
                  color={colors.white}
                >
                  - {exercise.exerciseName}
                </Typo>
              ))}
              {moreCountLabel && (
                <Typo size={12} color={colors.accent}>
                  {moreCountLabel}
                </Typo>
              )}
            </View>
          </View>

          <View style={styles.workoutRight}>
            <CaretRight size={20} color={colors.primary} weight="bold" />
          </View>
        </Pressable>
      </View>
    );
  },
);

RecentWorkoutRow.displayName = "RecentWorkoutRow";

export default RecentWorkoutRow;

const styles = StyleSheet.create({
  outer: {
    position: "relative",
    marginBottom: 6,
    marginRight: 6,
  },
  shadowLayer: {
    position: "absolute",
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    borderRadius: radius._17,
    backgroundColor: colors.black,
    opacity: 0.25,
  },
  workoutItem: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius._17,
    padding: spacingX._15,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    alignItems: "center",
    minHeight: 44,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.85,
  },
  workoutLeft: {
    flex: 1,
    gap: spacingY._10,
  },
  workoutDate: {
    gap: spacingY._7,
  },
  workoutMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
  },
  workoutExercises: {
    gap: verticalScale(2),
  },
  workoutRight: {
    marginLeft: spacingX._15,
    width: 32,
    height: 32,
    borderRadius: radius._12,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});

