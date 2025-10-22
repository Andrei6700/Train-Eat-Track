// src/components/ui/WorkoutCard.tsx
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { WorkoutHistory } from "@/src/types/index";
import { formatDuration } from "@/src/utils/utils";
import { verticalScale } from "@/src/utils/styling";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Typo from "./Typo";

type WorkoutCardProps = {
  workout: WorkoutHistory;
};

const WorkoutCard = ({ workout }: WorkoutCardProps) => {
  const router = useRouter();

  const formatDate = (date: Date | string) => {
    const workoutDate = new Date(date);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (workoutDate.toDateString() === today.toDateString()) {
      return "Today";
    } else if (workoutDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return workoutDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    }
  };

  const getTotalSets = () => {
    return workout.exercises?.reduce((total, exercise) => {
      return total + (exercise.sets?.length || 0);
    }, 0) ?? 0;
  };

  const getExerciseNames = () => {
    return workout.exercises?.map((ex) => ex.exerciseName) || [];
  };

  const handlePress = () => {
    router.push({
      pathname: `/workoutDetail`,
      params: { workoutId: workout.id },
    });
  };

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.7}
      onPress={handlePress}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Typo size={18} fontWeight="600" color={colors.white}>
            {formatDate(workout.date)}
          </Typo>
          <View style={styles.durationRow}>
            <Icons.TimerIcon size={16} color={colors.neutral400} />
            <Typo size={14} color={colors.neutral400}>
              {formatDuration(workout.duration)}
            </Typo>
          </View>
        </View>

        <View style={styles.iconContainer}>
          <Icons.BarbellIcon size={24} color={colors.primary} weight="fill" />
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBadge}>
          <Typo size={13} fontWeight="500" color={colors.white}>
            {workout.exercises?.length || 0} exercises
          </Typo>
        </View>
        <View style={styles.statBadge}>
          <Typo size={13} fontWeight="500" color={colors.white}>
            {getTotalSets()} sets
          </Typo>
        </View>
      </View>

      {/* Exercise List */}
      {workout.exercises && workout.exercises.length > 0 && (
        <View style={styles.exercisesSection}>
          <Typo size={14} fontWeight="600" color={colors.neutral200}>
            Exercises:
          </Typo>
          <View style={styles.exercisesList}>
            {getExerciseNames()
              .slice(0, 3)
              .map((name, index) => (
                <View key={index} style={styles.exerciseBadge}>
                  <Typo size={12} fontWeight="500" color={colors.white}>
                    {name}
                  </Typo>
                </View>
              ))}
            {getExerciseNames().length > 3 && (
              <View style={styles.exerciseBadge}>
                <Typo size={12} fontWeight="500" color={colors.neutral400}>
                  +{getExerciseNames().length - 3} more
                </Typo>
              </View>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default WorkoutCard;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    borderCurve: "continuous",
    padding: spacingX._20,
    marginBottom: spacingY._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacingY._15,
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._5,
    marginTop: spacingY._5,
  },
  iconContainer: {
    backgroundColor: colors.neutral700,
    width: verticalScale(48),
    height: verticalScale(48),
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    marginBottom: spacingY._15,
  },
  statBadge: {
    backgroundColor: colors.neutral700,
    borderRadius: radius._10,
    paddingHorizontal: spacingX._12,
    paddingVertical: verticalScale(6),
  },
  exercisesSection: {
    gap: spacingY._10,
  },
  exercisesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacingX._7,
  },
  exerciseBadge: {
    backgroundColor: colors.neutral700,
    borderRadius: radius._10,
    paddingHorizontal: spacingX._12,
    paddingVertical: verticalScale(4),
  },
});