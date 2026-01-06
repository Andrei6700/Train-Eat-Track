import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/src/utils/styling";
import * as Icons from "phosphor-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Typo from "./Typo";

type Goal = {
  icon: React.ReactNode;
  label: string;
  value: string;
  completed?: boolean;
  color: string;
};

type TodayGoalsCardProps = {
  workout?: string;
  nutrition?: string;
  water?: string;
  workoutCompleted?: boolean;
  nutritionCompleted?: boolean;
  waterCompleted?: boolean;
};

const TodayGoalsCard = React.memo(
  ({
    workout = "No plan for today",
    nutrition = "2500 kcal",
    water = "2L",
    workoutCompleted = false,
    nutritionCompleted = false,
    waterCompleted = false,
  }: TodayGoalsCardProps) => {
    const goals: Goal[] = [
      {
        icon: <Icons.Barbell size={22} color={colors.primary} weight="fill" />,
        label: "Workout",
        value: workout,
        completed: workoutCompleted,
        color: colors.primary,
      },
      {
        icon: <Icons.ForkKnife size={22} color="#F59E0B" weight="fill" />,
        label: "Nutrition",
        value: nutrition,
        completed: nutritionCompleted,
        color: "#F59E0B",
      },
      {
        icon: <Icons.Drop size={22} color="#3B82F6" weight="fill" />,
        label: "Water",
        value: water,
        completed: waterCompleted,
        color: "#3B82F6",
      },
    ];

    const completedCount = [workoutCompleted, nutritionCompleted, waterCompleted].filter(
      Boolean
    ).length;

    return (
      <Animated.View
        entering={FadeInDown.duration(600).delay(200).springify()}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Icons.Target size={24} color={colors.primary} weight="fill" />
            <Typo size={18} fontWeight="700" color={colors.white}>
              Today's Goals
            </Typo>
          </View>
          <View style={styles.completionBadge}>
            <Typo size={13} fontWeight="700" color={colors.white}>
              {completedCount}/3
            </Typo>
          </View>
        </View>

        {/* Goals List */}
        <View style={styles.goalsList}>
          {goals.map((goal, index) => (
            <View key={index} style={styles.goalItem}>
              <View
                style={[
                  styles.goalIconContainer,
                  { backgroundColor: `${goal.color}15` },
                ]}
              >
                {goal.icon}
              </View>

              <View style={styles.goalContent}>
                <Typo size={13} color={colors.neutral400}>
                  {goal.label}
                </Typo>
                <Typo size={15} fontWeight="600" color={colors.white}>
                  {goal.value}
                </Typo>
              </View>

              {goal.completed && (
                <View style={styles.checkmark}>
                  <Icons.Check size={16} color={colors.white} weight="bold" />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: `${(completedCount / 3) * 100}%` },
              ]}
            />
          </View>
          <Typo size={12} color={colors.neutral400} style={styles.progressText}>
            {completedCount === 3
              ? "All goals completed! "
              : `${3 - completedCount} remaining`}
          </Typo>
        </View>
      </Animated.View>
    );
  }
);

export default TodayGoalsCard;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._20,
    padding: spacingX._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
    marginBottom: spacingY._25,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacingY._20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  completionBadge: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    backgroundColor: colors.neutral700,
    borderRadius: radius._10,
  },
  goalsList: {
    gap: spacingY._12,
    marginBottom: spacingY._20,
  },
  goalItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._15,
    backgroundColor: colors.neutral900,
    padding: spacingX._15,
    borderRadius: radius._15,
  },
  goalIconContainer: {
    width: verticalScale(44),
    height: verticalScale(44),
    borderRadius: radius._12,
    alignItems: "center",
    justifyContent: "center",
  },
  goalContent: {
    flex: 1,
    gap: verticalScale(3),
  },
  checkmark: {
    width: verticalScale(28),
    height: verticalScale(28),
    backgroundColor: colors.green,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  progressSection: {
    paddingTop: spacingY._15,
    borderTopWidth: 1,
    borderTopColor: colors.neutral700,
  },
  progressBar: {
    width: "100%",
    height: verticalScale(8),
    backgroundColor: colors.neutral700,
    borderRadius: radius._10,
    overflow: "hidden",
    marginBottom: spacingY._10,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: radius._10,
  },
  progressText: {
    textAlign: "center",
  },
});