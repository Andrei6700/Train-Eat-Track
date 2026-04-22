import { colors, radius, spacingX } from "@/constants/theme";
import Typo from "@/src/components/ui/Typo";
import { useLanguage } from "@/src/contexts/languageContext";
import { getMealLabel } from "@/src/i18n/translations";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import * as Icons from "phosphor-react-native";
import NutritionFoodRow, { FoodWithBrand } from "./NutritionFoodRow";

const PROTEIN_COLOR = colors.macroProtein;
const CARBS_COLOR = colors.macroCarbs;
const FAT_COLOR = colors.macroFat;
const CIRCUMFERENCE = 2 * Math.PI * 40;

type MacroValues = {
  protein: number;
  carbs: number;
  fat: number;
};

export type MealSummary = {
  mealName: string;
  foods: FoodWithBrand[];
  calories: number;
  macros: MacroValues;
  percentages: MacroValues;
  arcs: MacroValues;
  hasFoods: boolean;
};

type NutritionMealCardProps = {
  summary: MealSummary;
  onMealPress: (mealName: string) => void;
  onFoodPress: (mealName: string, foodIndex: number, food: FoodWithBrand) => void;
  onFoodLongPress: (
    mealName: string,
    foodIndex: number,
    food: FoodWithBrand,
  ) => void;
};

const NutritionMealCard = ({
  summary,
  onMealPress,
  onFoodPress,
  onFoodLongPress,
}: NutritionMealCardProps) => {
  const { language, t } = useLanguage();
  return (
    <View style={styles.cardOuter}>
      <View style={styles.cardShadow} />
      <View style={styles.mealCard}>
        <View style={styles.mealHeader}>
          <Typo size={20} variant="heading" color={colors.textPrimary}>
            {getMealLabel(language, summary.mealName)}
          </Typo>
        </View>

        <View style={styles.nutritionRow}>
          <View style={styles.circleContainer}>
            <Svg width={80} height={80} viewBox="0 0 100 100">
              <Circle
                cx="50"
                cy="50"
                r="40"
                stroke={colors.border}
                strokeWidth="8"
                fill="none"
              />
              <Circle
                cx="50"
                cy="50"
                r="40"
                stroke={PROTEIN_COLOR}
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${summary.arcs.protein} ${CIRCUMFERENCE}`}
                strokeDashoffset="0"
                transform="rotate(-90 50 50)"
              />
              <Circle
                cx="50"
                cy="50"
                r="40"
                stroke={CARBS_COLOR}
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${summary.arcs.carbs} ${CIRCUMFERENCE}`}
                strokeDashoffset={-summary.arcs.protein}
                transform="rotate(-90 50 50)"
              />
              <Circle
                cx="50"
                cy="50"
                r="40"
                stroke={FAT_COLOR}
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${summary.arcs.fat} ${CIRCUMFERENCE}`}
                strokeDashoffset={-(summary.arcs.protein + summary.arcs.carbs)}
                transform="rotate(-90 50 50)"
              />
            </Svg>

            <View style={styles.circleText}>
              <Typo
                size={16}
                variant="metric"
                color={colors.primary}
                style={styles.calorieValueText}
              >
                {summary.calories.toFixed(0)}
              </Typo>
              <Typo
                size={10}
                color={colors.neutral400}
                style={styles.calorieLabelText}
              >
                kCal
              </Typo>
            </View>
          </View>

          <View style={styles.macroColumns}>
            <View style={styles.macroColumnItem}>
              <Typo
                size={12}
                variant="mono"
                color={colors.textPrimary}
                style={styles.macroPercent}
              >
                {summary.percentages.protein}%
              </Typo>
              <Typo
                size={14}
                variant="mono"
                color={colors.textPrimary}
                style={styles.macroValue}
              >
                {Math.round(summary.macros.protein)} g
              </Typo>
              <Typo size={10} color={colors.neutral400} style={styles.macroLabel}>
                {t("nutrition_short_protein")}
              </Typo>
            </View>

            <View style={styles.macroColumnItem}>
              <Typo
                size={12}
                variant="mono"
                color={colors.textPrimary}
                style={styles.macroPercent}
              >
                {summary.percentages.carbs}%
              </Typo>
              <Typo
                size={14}
                variant="mono"
                color={colors.textPrimary}
                style={styles.macroValue}
              >
                {Math.round(summary.macros.carbs)} g
              </Typo>
              <Typo size={10} color={colors.neutral400} style={styles.macroLabel}>
                {t("nutrition_short_carbs")}
              </Typo>
            </View>

            <View style={styles.macroColumnItem}>
              <Typo
                size={12}
                variant="mono"
                color={colors.textPrimary}
                style={styles.macroPercent}
              >
                {summary.percentages.fat}%
              </Typo>
              <Typo
                size={14}
                variant="mono"
                color={colors.textPrimary}
                style={styles.macroValue}
              >
                {Math.round(summary.macros.fat)} g
              </Typo>
              <Typo size={10} color={colors.neutral400} style={styles.macroLabel}>
                {t("nutrition_short_fat")}
              </Typo>
            </View>
          </View>
        </View>

        {summary.hasFoods && (
          <View style={styles.foodsList}>
            {summary.foods.map((food, index) => (
              <NutritionFoodRow
                key={`${food.name}-${index}`}
                food={food}
                onPress={() => onFoodPress(summary.mealName, index, food)}
                onLongPress={() => onFoodLongPress(summary.mealName, index, food)}
              />
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => onMealPress(summary.mealName)}
          accessibilityRole="button"
          accessibilityLabel={t("nutrition_add_foods")}
        >
          <Icons.Plus size={18} color={colors.primary} weight="bold" />
          <Typo size={15} fontWeight="600" color={colors.primary}>
            {t("nutrition_add_foods")}
          </Typo>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default React.memo(NutritionMealCard);

const styles = StyleSheet.create({
  cardOuter: {
    position: "relative",
    marginRight: 6,
  },
  cardShadow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.black,
    opacity: 0.25,
    borderRadius: radius._17,
  },
  mealCard: {
    backgroundColor: colors.surface,
    borderRadius: radius._17,
    padding: spacingX._20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mealHeader: {
    marginBottom: 16,
  },
  nutritionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius._12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  circleContainer: {
    position: "relative",
    width: 80,
    height: 80,
  },
  circleText: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  calorieValueText: {
    lineHeight: 18,
    marginBottom: 1,
  },
  calorieLabelText: {
    lineHeight: 12,
  },
  macroColumns: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flex: 1,
    marginLeft: 16,
  },
  macroColumnItem: {
    alignItems: "center",
    flex: 1,
  },
  macroPercent: {
    marginBottom: 2,
  },
  macroValue: {
    marginBottom: 1,
  },
  macroLabel: {
    lineHeight: 12,
  },
  foodsList: {
    gap: 8,
    marginBottom: 16,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius._12,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

