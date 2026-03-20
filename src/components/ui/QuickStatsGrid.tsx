import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import useReduceMotion from "@/src/hooks/useReduceMotion";
import { useLanguage } from "@/src/contexts/languageContext";
import { HomeQuickStats } from "@/src/features/home/homeSelectors";
import { verticalScale } from "@/src/utils/styling";
import { Barbell, Fire, Timer } from "phosphor-react-native";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Typo from "./Typo";

type QuickStatsGridProps = {
  stats: HomeQuickStats;
  loading?: boolean;
};

const QuickStatsGrid = React.memo(({ stats, loading }: QuickStatsGridProps) => {
  const { t } = useLanguage();
  const reduceMotion = useReduceMotion();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(400).delay(50)}
      style={styles.container}
    >
      <View style={styles.cardWrap}>
        <View style={styles.cardShadow} />
        <View style={styles.statCard}>
          <View style={[styles.statIcon, styles.primaryIconBackground]}>
            <Barbell size={24} color={colors.black} weight="fill" />
          </View>
          <Typo size={40} variant="metric" style={styles.statValue}>
            {stats.totalWorkouts}
          </Typo>
          <Typo size={12} variant="label" uppercase color={colors.textMuted} style={styles.statLabel}>
            {t("home_total_workouts")}
          </Typo>
        </View>
      </View>

      <View style={styles.cardWrap}>
        <View style={styles.cardShadow} />
        <View style={styles.statCard}>
          <View style={[styles.statIcon, styles.streakIconBackground]}>
            <Fire size={24} color={colors.white} weight="fill" />
          </View>
          <Typo size={40} variant="metric" style={styles.statValue}>
            {stats.currentStreak}
          </Typo>
          <Typo size={12} variant="label" uppercase color={colors.textMuted} style={styles.statLabel}>
            {t("home_day_streak")}
          </Typo>
        </View>
      </View>

      <View style={styles.cardWrap}>
        <View style={styles.cardShadow} />
        <View style={styles.statCard}>
          <View style={[styles.statIcon, styles.durationIconBackground]}>
            <Timer size={24} color={colors.white} weight="fill" />
          </View>
          <Typo size={40} variant="metric" style={styles.statValue}>
            {stats.totalHoursDisplay}h
          </Typo>
          <Typo size={12} variant="label" uppercase color={colors.textMuted} style={styles.statLabel}>
            {t("home_total_time")}
          </Typo>
        </View>
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
    paddingRight: 4,
    marginBottom: 6,
    alignItems: "stretch",
  },
  loadingContainer: {
    height: verticalScale(120),
    justifyContent: "center",
    alignItems: "center",
  },
  cardWrap: {
    flex: 1,
    position: "relative",
    minHeight: verticalScale(164),
  },
  cardShadow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.black,
    opacity: 0.25,
    borderRadius: radius._15,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius._15,
    padding: spacingX._15,
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIcon: {
    width: verticalScale(44),
    height: verticalScale(44),
    borderRadius: radius._12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryIconBackground: {
    backgroundColor: colors.primary,
  },
  streakIconBackground: {
    backgroundColor: colors.secondary,
  },
  durationIconBackground: {
    backgroundColor: colors.accent,
  },
  statValue: {
    marginTop: spacingY._10,
    minHeight: verticalScale(42),
    textAlign: "center",
    color: colors.primary,
  },
  statLabel: {
    textAlign: "center",
    minHeight: verticalScale(34),
    lineHeight: verticalScale(18),
  },
});

