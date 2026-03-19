import { colors, radius, spacingX, spacingY } from "@/constants/theme";
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.container}>
      <View style={styles.cardWrap}>
        <View style={styles.cardShadow} />
        <View style={styles.statCard}>
          <View style={[styles.statIcon, styles.primaryIconBackground]}>
            <Barbell size={24} color={colors.white} weight="fill" />
          </View>
          <Typo size={24} fontWeight="800" style={styles.statValue}>
            {stats.totalWorkouts}
          </Typo>
          <Typo size={13} color={colors.white} style={styles.statLabel}>
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
          <Typo size={24} fontWeight="800" style={styles.statValue}>
            {stats.currentStreak}
          </Typo>
          <Typo size={13} color={colors.white} style={styles.statLabel}>
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
          <Typo size={24} fontWeight="800" style={styles.statValue}>
            {stats.totalHoursDisplay}h
          </Typo>
          <Typo size={13} color={colors.white} style={styles.statLabel}>
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
    minHeight: verticalScale(170),
  },
  cardShadow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.cardShadow,
    borderRadius: radius._10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral800,
    borderRadius: radius._10,
    padding: spacingX._15,
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 2,
    borderColor: colors.border,
  },
  statIcon: {
    width: verticalScale(44),
    height: verticalScale(44),
    borderRadius: radius._10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryIconBackground: {
    backgroundColor: colors.primary,
  },
  streakIconBackground: {
    backgroundColor: colors.warning,
  },
  durationIconBackground: {
    backgroundColor: colors.success,
  },
  statValue: {
    marginTop: spacingY._10,
    minHeight: verticalScale(42),
    textAlign: "center",
    color: colors.white,
  },
  statLabel: {
    textAlign: "center",
    minHeight: verticalScale(34),
    lineHeight: verticalScale(18),
  },
});

