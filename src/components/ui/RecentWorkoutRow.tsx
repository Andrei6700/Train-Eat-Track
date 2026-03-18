import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { WorkoutHistory } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { formatDuration } from "@/src/utils/utils";
import { CaretRight, Timer } from "phosphor-react-native";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
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
      <TouchableOpacity style={styles.workoutItem} onPress={handlePress} activeOpacity={0.7}>
        <View style={styles.workoutLeft}>
          <View style={styles.workoutDate}>
            <Typo size={15} fontWeight="600">
              {workoutDateLabel}
            </Typo>
            <View style={styles.workoutMeta}>
              <Timer size={14} color={colors.neutral400} weight="fill" />
              <Typo size={13} color={colors.neutral400}>
                {formatDuration(workout.duration)}
              </Typo>
            </View>
          </View>

          <View style={styles.workoutExercises}>
            {workout.exercises.slice(0, 2).map((exercise, index) => (
              <Typo
                key={`${workout.id ?? workoutDateLabel}-${index}-${exercise.exerciseName}`}
                size={13}
                color={colors.neutral500}
              >
                - {exercise.exerciseName}
              </Typo>
            ))}
            {moreCountLabel && (
              <Typo size={12} color={colors.neutral600}>
                {moreCountLabel}
              </Typo>
            )}
          </View>
        </View>

        <View style={styles.workoutRight}>
          <CaretRight size={20} color={colors.neutral500} weight="bold" />
        </View>
      </TouchableOpacity>
    );
  },
);

RecentWorkoutRow.displayName = "RecentWorkoutRow";

export default RecentWorkoutRow;

const styles = StyleSheet.create({
  workoutItem: {
    flexDirection: "row",
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
    alignItems: "center",
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
  },
});
