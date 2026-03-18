import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useLanguage } from "@/src/contexts/languageContext";
import { LOCALE_BY_LANGUAGE } from "@/src/i18n/translations";
import { WorkoutHistory } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { useRouter } from "expo-router";
import { Barbell, Calendar } from "phosphor-react-native";
import React from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
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

  const formatDate = (date: Date | string) => {
    const workoutDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (workoutDate.toDateString() === today.toDateString()) {
      return t("common_today");
    } else if (workoutDate.toDateString() === yesterday.toDateString()) {
      return t("common_yesterday");
    } else {
      return workoutDate.toLocaleDateString(LOCALE_BY_LANGUAGE[language], {
        month: "short",
        day: "numeric",
      });
    }
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
    <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Calendar size={20} color={colors.primary} weight="fill" />
          <Typo size={18} fontWeight="700">
            {t("home_recent_activity")}
          </Typo>
        </View>
        {recentWorkouts.length > 0 && (
          <TouchableOpacity onPress={handleViewAll}>
            <Typo size={14} color={colors.primary} fontWeight="600">
              {t("home_see_all")}
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
          <Barbell size={48} color={colors.neutral600} weight="fill" />
          <Typo size={16} color={colors.neutral400} style={styles.emptyTitle}>
            {t("home_no_workouts_yet")}
          </Typo>
          <Typo size={14} color={colors.neutral500} style={styles.emptySubtitle}>
            {t("home_start_training_history")}
          </Typo>
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
  emptyTitle: {
    marginTop: spacingY._15,
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: spacingY._7,
    textAlign: "center",
  },
});

