import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import useReduceMotion from "@/src/hooks/useReduceMotion";
import { useLanguage } from "@/src/contexts/languageContext";
import { HomeWeekData } from "@/src/features/home/homeSelectors";
import { WEEK_DAY_SHORT_NAMES } from "@/src/i18n/translations";
import { verticalScale } from "@/src/utils/styling";
import { TrendUp } from "phosphor-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Typo from "./Typo";

type WeeklyActivityChartProps = {
  weekData: HomeWeekData;
};

const WeeklyActivityChart = React.memo(({ weekData }: WeeklyActivityChartProps) => {
  const { language, t } = useLanguage();
  const reduceMotion = useReduceMotion();

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(400).delay(100)}
      style={styles.outer}
    >
      <View style={styles.shadowLayer} />
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.titleIconWrap}>
              <TrendUp size={22} color={colors.black} weight="fill" />
            </View>
            <Typo size={20} variant="heading">
              {t("home_this_week")}
            </Typo>
          </View>
          <View style={styles.progressBadge}>
            <Typo size={12} variant="label" uppercase color={colors.textPrimary}>
              {t("home_days_progress", { count: weekData.workoutDaysCount })}
            </Typo>
          </View>
        </View>

        <View style={styles.chartBars}>
          {WEEK_DAY_SHORT_NAMES[language].map((day, index) => {
            const isRestDay = weekData.days[index] === 0 && weekData.restDays[index];

            return (
              <View key={day} style={styles.barContainer}>
                <View style={styles.barWrapper}>
                  {isRestDay ? (
                    <View style={styles.barRestDay} />
                  ) : (
                    <View
                      style={[
                        styles.bar,
                        weekData.days[index] > 0 && styles.barActive,
                        weekData.days[index] > 1 && styles.barHigh,
                      ]}
                    />
                  )}
                </View>
                <Typo size={11} color={colors.textMuted} style={styles.dayLabel}>
                  {day}
                </Typo>
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
});

WeeklyActivityChart.displayName = "WeeklyActivityChart";

export default WeeklyActivityChart;

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
    backgroundColor: colors.black,
    opacity: 0.25,
    borderRadius: radius._20,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius._20,
    padding: spacingX._20,
    borderWidth: 1,
    borderColor: colors.border,
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
  titleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius._10,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBadge: {
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacingX._12,
    paddingVertical: verticalScale(4),
    borderRadius: radius._12,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.border,
    borderRadius: radius._10,
  },
  barActive: {
    height: verticalScale(60),
    backgroundColor: colors.primary,
  },
  barHigh: {
    height: verticalScale(75),
  },
  barRestDay: {
    height: verticalScale(60),
    width: verticalScale(28),
    backgroundColor: "transparent",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.success,
    borderRadius: radius._10,
  },
  dayLabel: {
    marginTop: spacingY._7,
    color: colors.textMuted,
  },
});

