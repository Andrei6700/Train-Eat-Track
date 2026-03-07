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
      <View style={styles.statCard}>
        <View style={[styles.statIcon, styles.primaryIconBackground]}>
          <Barbell size={24} color={colors.primary} weight="fill" />
        </View>
        <Typo size={28} fontWeight="700" style={styles.statValue}>
          {stats.totalWorkouts}
        </Typo>
        <Typo size={13} color={colors.neutral400} style={styles.statLabel}>
          {t("home_total_workouts")}
        </Typo>
      </View>

      <View style={styles.statCard}>
        <View style={[styles.statIcon, styles.streakIconBackground]}>
          <Fire size={24} color="#EF4444" weight="fill" />
        </View>
        <Typo size={28} fontWeight="700" style={styles.statValue}>
          {stats.currentStreak}
        </Typo>
        <Typo size={13} color={colors.neutral400} style={styles.statLabel}>
          {t("home_day_streak")}
        </Typo>
      </View>

      <View style={styles.statCard}>
        <View style={[styles.statIcon, styles.durationIconBackground]}>
          <Timer size={24} color="#3B82F6" weight="fill" />
        </View>
        <Typo size={28} fontWeight="700" style={styles.statValue}>
          {stats.totalHoursDisplay}h
        </Typo>
        <Typo size={13} color={colors.neutral400} style={styles.statLabel}>
          {t("home_total_time")}
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
  primaryIconBackground: {
    backgroundColor: `${colors.primary}15`,
  },
  streakIconBackground: {
    backgroundColor: "#EF444415",
  },
  durationIconBackground: {
    backgroundColor: "#3B82F615",
  },
  statValue: {
    marginTop: spacingY._10,
    textAlign: "center",
  },
  statLabel: {
    textAlign: "center",
  },
});
