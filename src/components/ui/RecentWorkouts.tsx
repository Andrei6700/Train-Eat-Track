import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import useReduceMotion from "@/src/hooks/useReduceMotion";
import { useLanguage } from "@/src/contexts/languageContext";
import { LOCALE_BY_LANGUAGE } from "@/src/i18n/translations";
import { WorkoutHistory } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { useRouter } from "expo-router";
import { Barbell, Calendar } from "phosphor-react-native";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import RecentWorkoutRow from "./RecentWorkoutRow";
import Typo from "./Typo";

type RecentWorkoutsProps = {
  recentWorkouts: WorkoutHistory[];
  loading?: boolean;
};

const RecentWorkouts = React.memo(({ recentWorkouts, loading }: RecentWorkoutsProps) => {
  const router = useRouter();
  const { language, t } = useLanguage();
  const reduceMotion = useReduceMotion();

  const formatDate = (date: Date | string) => {
    const workoutDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (workoutDate.toDateString() === today.toDateString()) {
      return t("common_today");
    }
    if (workoutDate.toDateString() === yesterday.toDateString()) {
      return t("common_yesterday");
    }
    return workoutDate.toLocaleDateString(LOCALE_BY_LANGUAGE[language], {
      month: "short",
      day: "numeric",
    });
  };

  const handleViewAll = () => {
    router.push("/(tabs)/history");
  };

  const handleWorkoutPress = (workoutId: string) => {
    if (!workoutId) return;
    router.push({
      pathname: "/(modals)/workoutDetail",
      params: { workoutId },
    });
  };

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(400).delay(150)}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleIconWrap}>
            <Calendar size={20} color={colors.black} weight="fill" />
          </View>
          <Typo size={20} variant="heading">
            {t("home_recent_activity")}
          </Typo>
        </View>
        {recentWorkouts.length > 0 && (
          <Pressable onPress={handleViewAll} style={({ pressed }) => [styles.viewAllButton, pressed && styles.pressed]}>
            <Typo size={12} variant="label" uppercase color={colors.textPrimary}>
              {t("home_see_all")}
            </Typo>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.placeholderOuter}>
          <View style={styles.placeholderShadow} />
          <View style={styles.placeholderCard}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        </View>
      ) : recentWorkouts.length === 0 ? (
        <View style={styles.placeholderOuter}>
          <View style={styles.placeholderShadow} />
          <View style={styles.emptyState}>
            <Barbell size={48} color={colors.secondary} weight="fill" />
            <Typo size={16} color={colors.textPrimary} style={styles.emptyTitle}>
              {t("home_no_workouts_yet")}
            </Typo>
            <Typo size={14} color={colors.textMuted} style={styles.emptySubtitle}>
              {t("home_start_training_history")}
            </Typo>
          </View>
        </View>
      ) : (
        <View style={styles.workoutsList}>
          {recentWorkouts.map((workout, index) => (
            <RecentWorkoutRow
              key={workout.id ?? `recent-workout-${index}-${String(workout.date)}`}
              workout={workout}
              workoutDateLabel={formatDate(workout.date)}
              moreCountLabel={
                workout.exercises.length > 2
                  ? t("common_more_count", { count: workout.exercises.length - 2 })
                  : undefined
              }
              onPress={handleWorkoutPress}
            />
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
  titleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius._10,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  viewAllButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacingX._10,
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius._12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.8,
  },
  placeholderOuter: {
    position: "relative",
    marginBottom: 6,
    marginRight: 6,
  },
  placeholderShadow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.black,
    opacity: 0.25,
    borderRadius: radius._17,
  },
  placeholderCard: {
    height: verticalScale(120),
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius._17,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: radius._17,
    padding: spacingY._50,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  workoutsList: {
    gap: spacingY._12,
  },
  emptyTitle: {
    marginTop: spacingY._15,
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: spacingY._7,
    textAlign: "center",
  },
});

