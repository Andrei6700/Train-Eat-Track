import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { WorkoutHistory } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { formatDuration } from "@/src/utils/utils";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useCallback } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Typo from "./Typo";

type RecentWorkoutsProps = {
  workouts: WorkoutHistory[];
  loading?: boolean;
};

const RecentWorkouts = React.memo(({ workouts, loading }: RecentWorkoutsProps) => {
  const router = useRouter();

  const formatDate = useCallback((date: Date | string) => {
    const workoutDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (workoutDate.toDateString() === today.toDateString()) {
      return "Today";
    } else if (workoutDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return workoutDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  }, []);

  const handleViewAll = useCallback(() => {
    router.push("/(tabs)/history");
  }, [router]);

  const handleWorkoutPress = useCallback((workoutId: string) => {
    router.push({
      pathname: "/(modals)/workoutDetail",
      params: { workoutId },
    });
  }, [router]);

  const recentWorkouts = workouts.slice(0, 3);

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Icons.Calendar size={20} color={colors.primary} weight="fill" />
          <Typo size={18} fontWeight="700">
            Recent Activity
          </Typo>
        </View>
        {workouts.length > 0 && (
          <TouchableOpacity onPress={handleViewAll}>
            <Typo size={14} color={colors.primary} fontWeight="600">
              See All
            </Typo>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : recentWorkouts.length === 0 ? (
        <View style={styles.emptyState}>
          <Icons.Barbell size={48} color={colors.neutral600} weight="fill" />
          <Typo
            size={16}
            color={colors.neutral400}
            style={{ marginTop: spacingY._15, textAlign: "center" }}
          >
            No workouts yet
          </Typo>
          <Typo
            size={14}
            color={colors.neutral500}
            style={{ marginTop: spacingY._7, textAlign: "center" }}
          >
            Start training to see your history
          </Typo>
        </View>
      ) : (
        <View style={styles.workoutsList}>
          {recentWorkouts.map((workout) => (
            <TouchableOpacity
              key={workout.id}
              style={styles.workoutItem}
              onPress={() => handleWorkoutPress(workout.id!)}
              activeOpacity={0.7}
            >
              <View style={styles.workoutLeft}>
                <View style={styles.workoutDate}>
                  <Typo size={15} fontWeight="600">
                    {formatDate(workout.date)}
                  </Typo>
                  <View style={styles.workoutMeta}>
                    <Icons.Timer size={14} color={colors.neutral400} weight="fill" />
                    <Typo size={13} color={colors.neutral400}>
                      {formatDuration(workout.duration)}
                    </Typo>
                  </View>
                </View>

                <View style={styles.workoutExercises}>
                  {workout.exercises?.slice(0, 2).map((ex, idx) => (
                    <Typo key={idx} size={13} color={colors.neutral500}>
                      • {ex.exerciseName}
                    </Typo>
                  ))}
                  {workout.exercises && workout.exercises.length > 2 && (
                    <Typo size={12} color={colors.neutral600}>
                      +{workout.exercises.length - 2} more
                    </Typo>
                  )}
                </View>
              </View>

              <View style={styles.workoutRight}>
                <Icons.CaretRight size={20} color={colors.neutral500} weight="bold" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </Animated.View>
  );
});

RecentWorkouts.displayName = "RecentWorkouts";

export default RecentWorkouts;

const styles = StyleSheet.create({
  container: {
    gap: spacingY._15,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  loadingContainer: {
    height: verticalScale(200),
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  emptyState: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingY._50,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  workoutsList: {
    gap: spacingY._12,
  },
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