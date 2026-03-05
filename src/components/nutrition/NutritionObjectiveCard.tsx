import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Typo from "@/src/components/ui/Typo";
import { verticalScale } from "@/src/utils/styling";
import React, { useMemo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Icons from "phosphor-react-native";

export type NutritionStats = {
  totalCalories: number;
  totalMacros: { protein: number; carbs: number; fat: number };
  remainingCalories: number;
  progress: number;
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  proteinProgress: number;
  carbsProgress: number;
  fatProgress: number;
};

const PROTEIN_COLOR = "#10B981";
const CARBS_COLOR = "#EF4444";
const FAT_COLOR = "#F59E0B";
const FIRE_COLOR = "#FF6B35";

const NutritionObjectiveCard = ({ stats }: { stats: NutritionStats }) => {
  const progressFillStyle = useMemo<ViewStyle>(
    () => ({ height: `${stats.progress}%` }),
    [stats.progress],
  );
  const proteinFillStyle = useMemo<ViewStyle>(
    () => ({ width: `${stats.proteinProgress}%`, backgroundColor: PROTEIN_COLOR }),
    [stats.proteinProgress],
  );
  const carbsFillStyle = useMemo<ViewStyle>(
    () => ({ width: `${stats.carbsProgress}%`, backgroundColor: CARBS_COLOR }),
    [stats.carbsProgress],
  );
  const fatFillStyle = useMemo<ViewStyle>(
    () => ({ width: `${stats.fatProgress}%`, backgroundColor: FAT_COLOR }),
    [stats.fatProgress],
  );

  return (
    <Animated.View
      entering={FadeInDown.duration(400).delay(100)}
      style={styles.objectiveCard}
    >
      <View style={styles.mainContent}>
        <View style={styles.leftSection}>
          <View style={styles.objectivesContainer}>
            <View style={styles.objectiveItem}>
              <View style={styles.objectiveHeader}>
                <Icons.Target size={20} color={colors.primary} weight="fill" />
                <Typo size={16} fontWeight="600" color={colors.white}>
                  Obiectiv
                </Typo>
              </View>
              <Typo
                size={20}
                fontWeight="700"
                color={colors.white}
                style={styles.calorieValue}
              >
                {stats.calorieGoal} kcal
              </Typo>
            </View>
            <View style={styles.objectiveItem}>
              <View style={styles.objectiveHeader}>
                <Icons.Fire size={20} color={FIRE_COLOR} weight="fill" />
                <Typo size={16} fontWeight="600" color={colors.white}>
                  Consumat
                </Typo>
              </View>
              <Typo
                size={20}
                fontWeight="700"
                color={colors.white}
                style={styles.calorieValue}
              >
                {stats.totalCalories} kcal
              </Typo>
            </View>
          </View>
        </View>

        <View style={styles.rightSection}>
          <View style={styles.progressCircleContainer}>
            <View style={styles.progressCircle}>
              <View style={[styles.progressFill, progressFillStyle]} />
              <View style={styles.circleInner}>
                <Typo
                  size={18}
                  fontWeight="700"
                  color={colors.white}
                  style={styles.remainingCalories}
                >
                  {stats.remainingCalories}
                </Typo>
                <Typo size={12} color={colors.neutral400}>
                  kcal ramase
                </Typo>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.macrosContainer}>
        <View style={styles.macroItem}>
          <Typo size={12} color={colors.neutral400} style={styles.macroLabel}>
            Proteine
          </Typo>
          <View style={styles.macroProgressBar}>
            <View style={[styles.macroProgressFill, proteinFillStyle]} />
          </View>
          <Typo size={14} fontWeight="600" color={colors.white} style={styles.macroValue}>
            {Math.round(stats.totalMacros.protein)}g / {stats.proteinGoal}g
          </Typo>
        </View>

        <View style={styles.macroItem}>
          <Typo size={12} color={colors.neutral400} style={styles.macroLabel}>
            Carbohidrati
          </Typo>
          <View style={styles.macroProgressBar}>
            <View style={[styles.macroProgressFill, carbsFillStyle]} />
          </View>
          <Typo size={14} fontWeight="600" color={colors.white} style={styles.macroValue}>
            {Math.round(stats.totalMacros.carbs)}g / {stats.carbsGoal}g
          </Typo>
        </View>

        <View style={styles.macroItem}>
          <Typo size={12} color={colors.neutral400} style={styles.macroLabel}>
            Grasimi
          </Typo>
          <View style={styles.macroProgressBar}>
            <View style={[styles.macroProgressFill, fatFillStyle]} />
          </View>
          <Typo size={14} fontWeight="600" color={colors.white} style={styles.macroValue}>
            {Math.round(stats.totalMacros.fat)}g / {stats.fatGoal}g
          </Typo>
        </View>
      </View>
    </Animated.View>
  );
};

export default React.memo(NutritionObjectiveCard);

const styles = StyleSheet.create({
  objectiveCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    marginBottom: spacingY._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  mainContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._20,
  },
  leftSection: {
    flex: 1,
  },
  objectivesContainer: {
    gap: spacingY._15,
  },
  objectiveItem: {
    gap: verticalScale(6),
  },
  objectiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
  },
  calorieValue: {
    marginLeft: spacingX._30,
  },
  rightSection: {
    alignItems: "center",
    justifyContent: "center",
  },
  progressCircleContainer: {
    position: "relative",
    width: verticalScale(120),
    height: verticalScale(120),
  },
  progressCircle: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
    backgroundColor: colors.neutral700,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  progressFill: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "100%",
    backgroundColor: colors.primary,
  },
  circleInner: {
    width: verticalScale(100),
    height: verticalScale(100),
    borderRadius: 50,
    backgroundColor: colors.neutral800,
    justifyContent: "center",
    alignItems: "center",
    gap: verticalScale(2),
  },
  remainingCalories: {
    lineHeight: 24,
  },
  macrosContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  macroItem: {
    alignItems: "center",
    flex: 1,
    gap: verticalScale(6),
  },
  macroLabel: {
    textAlign: "center",
    marginBottom: verticalScale(4),
  },
  macroProgressBar: {
    width: "80%",
    height: 4,
    backgroundColor: colors.neutral700,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: verticalScale(4),
  },
  macroProgressFill: {
    height: "100%",
    borderRadius: 2,
  },
  macroValue: {
    textAlign: "center",
  },
});
