import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Typo from "@/src/components/ui/Typo";
import { useLanguage } from "@/src/contexts/languageContext";
import { verticalScale } from "@/src/utils/styling";
import * as Icons from "phosphor-react-native";
import React, { useMemo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

export type NutritionStats = {
  totalCalories: number;
  totalMacros: { protein: number; carbs: number; fat: number };
  remainingCalories: number;
  overCalories: number;
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
const RING_COLOR_REMAINING = "#7DDC8A";
const RING_COLOR_OVER_WARNING = "#F6B64E";
const RING_COLOR_OVER_DANGER = "#EE7B80";
const RING_TRACK_COLOR = "#A3A8AE";
const RING_SIZE = verticalScale(124);
const RING_RADIUS = 54;
const RING_STROKE_WIDTH = 12;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const NutritionObjectiveCard = ({ stats }: { stats: NutritionStats }) => {
  const { t } = useLanguage();
  const proteinFillStyle = useMemo<ViewStyle>(
    () => ({
      width: `${stats.proteinProgress}%`,
      backgroundColor: PROTEIN_COLOR,
    }),
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
  const isOverCalories = stats.overCalories > 0;
  const ringColor = useMemo(() => {
    if (!isOverCalories) return RING_COLOR_REMAINING;
    return stats.overCalories > 350
      ? RING_COLOR_OVER_DANGER
      : RING_COLOR_OVER_WARNING;
  }, [isOverCalories, stats.overCalories]);
  const displayValue = isOverCalories
    ? stats.overCalories
    : stats.remainingCalories;
  const displayLabel = isOverCalories
    ? t("nutrition_over_kcal_label")
    : t("nutrition_remaining_kcal");
  const ringProgress = isOverCalories
    ? 100
    : Math.max(0, Math.min(stats.progress, 100));
  const ringStrokeDashOffset =
    RING_CIRCUMFERENCE - (ringProgress / 100) * RING_CIRCUMFERENCE;

  return (
    <Animated.View
      entering={FadeInDown.duration(400).delay(100)}
      style={styles.cardOuter}
    >
      <View style={styles.cardShadow} />
      <View style={styles.objectiveCard}>
        <View style={styles.mainContent}>
          <View style={styles.leftSection}>
            <View style={styles.objectivesContainer}>
              <View style={styles.objectiveItem}>
                <View style={styles.objectiveHeader}>
                  <Icons.Target size={20} color={colors.primary} weight="fill" />
                  <Typo size={16} fontWeight="600" color={colors.white}>
                    {t("nutrition_target")}
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
                    {t("nutrition_consumed")}
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
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox="0 0 124 124">
                <Circle
                  cx="62"
                  cy="62"
                  r={RING_RADIUS}
                  stroke={RING_TRACK_COLOR}
                  strokeWidth={RING_STROKE_WIDTH}
                  fill="none"
                  opacity={0.5}
                />
                <Circle
                  cx="62"
                  cy="62"
                  r={RING_RADIUS}
                  stroke={ringColor}
                  strokeWidth={RING_STROKE_WIDTH}
                  fill="none"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={ringStrokeDashOffset}
                  strokeLinecap="round"
                  rotation="-90"
                  origin="62, 62"
                />
              </Svg>

              <View style={styles.circleInner}>
                <Typo
                  size={21}
                  fontWeight="700"
                  color={ringColor}
                  style={styles.centerValue}
                >
                  {displayValue}
                </Typo>
                <Typo
                  size={10}
                  color={colors.neutral200}
                  style={styles.centerLabel}
                  textProps={{ numberOfLines: 1 }}
                >
                  {displayLabel}
                </Typo>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.macrosContainer}>
          <View style={styles.macroItem}>
            <Typo size={12} color={colors.neutral400} style={styles.macroLabel}>
              {t("nutrition_protein")}
            </Typo>
            <View style={styles.macroProgressBar}>
              <View style={[styles.macroProgressFill, proteinFillStyle]} />
            </View>
            <Typo
              size={14}
              fontWeight="600"
              color={colors.white}
              style={styles.macroValue}
            >
              {Math.round(stats.totalMacros.protein)}g / {stats.proteinGoal}g
            </Typo>
          </View>

          <View style={styles.macroItem}>
            <Typo size={12} color={colors.neutral400} style={styles.macroLabel}>
              {t("nutrition_carbs")}
            </Typo>
            <View style={styles.macroProgressBar}>
              <View style={[styles.macroProgressFill, carbsFillStyle]} />
            </View>
            <Typo
              size={14}
              fontWeight="600"
              color={colors.white}
              style={styles.macroValue}
            >
              {Math.round(stats.totalMacros.carbs)}g / {stats.carbsGoal}g
            </Typo>
          </View>

          <View style={styles.macroItem}>
            <Typo size={12} color={colors.neutral400} style={styles.macroLabel}>
              {t("nutrition_fat")}
            </Typo>
            <View style={styles.macroProgressBar}>
              <View style={[styles.macroProgressFill, fatFillStyle]} />
            </View>
            <Typo
              size={14}
              fontWeight="600"
              color={colors.white}
              style={styles.macroValue}
            >
              {Math.round(stats.totalMacros.fat)}g / {stats.fatGoal}g
            </Typo>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

export default React.memo(NutritionObjectiveCard);

const styles = StyleSheet.create({
  cardOuter: {
    position: "relative",
    marginBottom: spacingY._20,
    marginRight: 6,
  },
  cardShadow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.cardShadow,
    borderRadius: radius._17,
  },
  objectiveCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    borderWidth: 2,
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
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  circleInner: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    gap: verticalScale(1),
  },
  centerValue: {
    lineHeight: 26,
  },
  centerLabel: {
    textAlign: "center",
    paddingHorizontal: spacingX._7,
    lineHeight: 16,
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

