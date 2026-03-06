import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useLanguage } from "@/src/contexts/languageContext";
import { WEEK_DAY_SHORT_NAMES } from "@/src/i18n/translations";
import { WorkoutHistory } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import * as Icons from "phosphor-react-native";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Typo from "./Typo";

type WeeklyActivityChartProps = {
  workouts: WorkoutHistory[];
};

const WeeklyActivityChart = React.memo(({ workouts }: WeeklyActivityChartProps) => {
  const { language, t } = useLanguage();
  const weekData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const weekWorkoutCounts: number[] = [0, 0, 0, 0, 0, 0, 0];
    const weekRestDays: boolean[] = [false, false, false, false, false, false, false];

    workouts.forEach((workout) => {
      const workoutDate = new Date(workout.date);
      workoutDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (workoutDate.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays >= 0 && diffDays < 7) {
        if (workout.isRestDay) {
          weekRestDays[diffDays] = true;
          return;
        }

        weekWorkoutCounts[diffDays]++;
      }
    });

    const workoutDaysCount = weekWorkoutCounts.filter((count) => count > 0).length;

    return {
      days: weekWorkoutCounts,
      restDays: weekRestDays,
      workoutDaysCount,
    };
  }, [workouts]);

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Icons.TrendUp size={22} color={colors.primary} weight="fill" />
          <Typo size={18} fontWeight="700">
            {t("home_this_week")}
          </Typo>
        </View>
        <View style={styles.progressBadge}>
          <Typo size={13} fontWeight="600" color={colors.white}>
            {t("home_days_progress", { count: weekData.workoutDaysCount })}
          </Typo>
        </View>
      </View>

      <View style={styles.chartBars}>
        {WEEK_DAY_SHORT_NAMES[language].map((day, index) => (
          <View key={day} style={styles.barContainer}>
            <View style={styles.barWrapper}>
              {/*
                Rest days are intentionally rendered as outlined/dashed bars
                so users can distinguish them from no-data days.
              */}
              <View
                style={[
                  styles.bar,
                  weekData.days[index] > 0 && styles.barActive,
                  weekData.days[index] === 0 && weekData.restDays[index] && styles.barRestDay,
                  weekData.days[index] > 1 && { height: verticalScale(75) },
                ]}
              />
            </View>
            <Typo size={11} color={colors.neutral500} style={{ marginTop: spacingY._7 }}>
              {day}
            </Typo>
          </View>
        ))}
      </View>
    </Animated.View>
  );
});

WeeklyActivityChart.displayName = "WeeklyActivityChart";

export default WeeklyActivityChart;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._20,
    padding: spacingX._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  progressBadge: {
    backgroundColor: colors.neutral700,
    paddingHorizontal: spacingX._12,
    paddingVertical: verticalScale(4),
    borderRadius: radius._10,
  },
  chartBars: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  barContainer: {
    flex: 1,
    alignItems: "center",
  },
  barWrapper: {
    height: verticalScale(80),
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    width: verticalScale(28),
    height: verticalScale(20),
    backgroundColor: colors.neutral700,
    borderRadius: radius._10,
  },
  barActive: {
    height: verticalScale(60),
    backgroundColor: colors.primary,
  },
  barRestDay: {
    height: verticalScale(60),
    backgroundColor: "transparent",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.neutral500,
  },
});
