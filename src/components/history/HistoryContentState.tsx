import { colors, spacingX, spacingY } from "@/constants/theme";
import { useLanguage } from "@/src/contexts/languageContext";
import WorkoutCard from "@/src/components/ui/WorkoutCard";
import Typo from "@/src/components/ui/Typo";
import { WorkoutHistory } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import * as Icons from "phosphor-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";

export type HistoryContentStateProps = {
  selectedWorkout: WorkoutHistory | null;
  hasAnyWorkouts: boolean;
  isSelectedDayRestDay: boolean;
};

const HistoryContentState = ({
  selectedWorkout,
  hasAnyWorkouts,
  isSelectedDayRestDay,
}: HistoryContentStateProps) => {
  const { t } = useLanguage();
  if (selectedWorkout) {
    return (
      <View style={styles.selectedWorkoutSection}>
        <Typo
          size={18}
          fontWeight="600"
          color={colors.neutral200}
          style={styles.sectionTitle}
        >
          {t("history_workout_details")}
        </Typo>
        <WorkoutCard workout={selectedWorkout} />
      </View>
    );
  }

  if (isSelectedDayRestDay) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Icons.Coffee
            size={48}
            color={colors.neutral500}
            weight="fill"
          />
        </View>
        <Typo
          size={18}
          fontWeight="600"
          color={colors.neutral200}
          style={styles.emptyTitle}
        >
          {t("workout_rest_day")}
        </Typo>
        <Typo
          size={15}
          color={colors.neutral400}
          style={styles.emptySubtitle}
        >
          {t("workout_rest_day_planned")}
        </Typo>
      </View>
    );
  }

  if (!hasAnyWorkouts) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Icons.Barbell
            size={64}
            color={colors.neutral500}
            weight="fill"
          />
        </View>
        <Typo
          size={20}
          fontWeight="600"
          color={colors.neutral200}
          style={styles.emptyTitle}
        >
          {t("history_no_workouts_logged")}
        </Typo>
        <Typo
          size={15}
          color={colors.neutral400}
          style={styles.emptySubtitle}
        >
          {t("history_start_training_here")}
        </Typo>
      </View>
    );
  }

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Icons.CalendarBlank
          size={48}
          color={colors.neutral500}
          weight="fill"
        />
      </View>
      <Typo
        size={18}
        fontWeight="600"
        color={colors.neutral200}
        style={styles.emptyTitle}
      >
        {t("history_no_workout_on_day")}
      </Typo>
      <Typo
        size={15}
        color={colors.neutral400}
        style={styles.emptySubtitle}
      >
        {t("history_select_another_day")}
      </Typo>
    </View>
  );
};

export default React.memo(HistoryContentState);

const styles = StyleSheet.create({
  selectedWorkoutSection: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: spacingY._15,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: verticalScale(60),
    paddingHorizontal: spacingX._30,
  },
  emptyIconContainer: {
    backgroundColor: colors.neutral800,
    padding: spacingX._25,
    borderRadius: 100,
  },
  emptyTitle: {
    textAlign: "center",
    marginTop: spacingY._15,
  },
  emptySubtitle: {
    textAlign: "center",
    marginTop: spacingY._10,
  },
});
