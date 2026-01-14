import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { WorkoutHistory } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import * as Icons from "phosphor-react-native";
import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Typo from "./Typo";

type QuickStatsGridProps = {
  workouts: WorkoutHistory[];
  loading?: boolean;
};

const QuickStatsGrid = React.memo(({ workouts, loading }: QuickStatsGridProps) => {
  const stats = useMemo(() => {
    if (!workouts || workouts.length === 0) {
      return {
        totalWorkouts: 0,
        totalMinutes: 0,
        currentStreak: 0,
      };
    }

    const totalWorkouts = workouts.length;
    const totalTime = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);
    const totalMinutes = Math.floor(totalTime / 60);

    // Calculate current streak using the same logic as aiCoachService
    const sortedWorkouts = [...workouts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const workout of sortedWorkouts) {
      const workoutDate = new Date(workout.date);
      workoutDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (currentDate.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === streak) {
        streak++;
        currentDate = workoutDate;
      } else if (diffDays === streak + 1) {
        // Allow one day gap
        streak++;
        currentDate = workoutDate;
      } else {
        break;
      }
    }

    return {
      totalWorkouts,
      totalMinutes,
      currentStreak: streak,
    };
  }, [workouts]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.container}>
      <View style={styles.statCard}>
        <View style={[styles.statIcon, { backgroundColor: `${colors.primary}15` }]}>
          <Icons.Barbell size={24} color={colors.primary} weight="fill" />
        </View>
        <Typo size={28} fontWeight="700" style={{ marginTop: spacingY._10 }}>
          {stats.totalWorkouts}
        </Typo>
        <Typo size={13} color={colors.neutral400}>
          Total Workouts
        </Typo>
      </View>

      <View style={styles.statCard}>
        <View style={[styles.statIcon, { backgroundColor: "#EF444415" }]}>
          <Icons.Fire size={24} color="#EF4444" weight="fill" />
        </View>
        <Typo size={28} fontWeight="700" style={{ marginTop: spacingY._10 }}>
          {stats.currentStreak}
        </Typo>
        <Typo size={13} color={colors.neutral400}>
          Day Streak
        </Typo>
      </View>

      <View style={styles.statCard}>
        <View style={[styles.statIcon, { backgroundColor: "#3B82F615" }]}>
          <Icons.Timer size={24} color="#3B82F6" weight="fill" />
        </View>
        <Typo size={28} fontWeight="700" style={{ marginTop: spacingY._10 }}>
          {stats.totalMinutes}m
        </Typo>
        <Typo size={13} color={colors.neutral400}>
          Total Time
        </Typo>
      </View>
    </Animated.View>
  );
});

QuickStatsGrid.displayName = "QuickStatsGrid";

export default QuickStatsGrid;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: spacingX._12,
  },
  loadingContainer: {
    height: verticalScale(120),
    justifyContent: "center",
    alignItems: "center",
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
  statIcon: {
    width: verticalScale(44),
    height: verticalScale(44),
    borderRadius: radius._12,
    alignItems: "center",
    justifyContent: "center",
  },
});