import { colors } from "@/constants/theme";
import Typo from "@/src/components/ui/Typo";
import { Food } from "@/src/types/index";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import * as Icons from "phosphor-react-native";

export type FoodWithBrand = Food & {
  brand?: string;
};

type NutritionFoodRowProps = {
  food: FoodWithBrand;
  onPress: () => void;
  onLongPress: () => void;
};

const PROTEIN_COLOR = "#10B981";
const CARBS_COLOR = "#EF4444";
const FAT_COLOR = "#F59E0B";

const roundSafe = (value: number | undefined): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value as number);
};

const NutritionFoodRow = ({ food, onPress, onLongPress }: NutritionFoodRowProps) => {
  return (
    <TouchableOpacity style={styles.foodItem} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.foodMainRow}>
        <View style={styles.foodIconBox}>
          <Icons.Package size={20} color={colors.primary} weight="fill" />
        </View>

        <View style={styles.foodContentColumn}>
          <Typo
            size={14}
            fontWeight="600"
            color={colors.white}
            textProps={{ numberOfLines: 1 }}
          >
            {food.name}
          </Typo>
          {!!food.brand && (
            <Typo
              size={11}
              color={colors.neutral400}
              textProps={{ numberOfLines: 1 }}
            >
              {food.brand}
            </Typo>
          )}

          <View style={styles.foodMetricsRow}>
            <View style={styles.metricItem}>
              <Icons.Scales size={12} color={colors.neutral400} weight="fill" />
              <Typo size={11} color={colors.white}>
                {food.servingSize || "100"} Grame
              </Typo>
            </View>

            <View style={styles.metricItem}>
              <Icons.Flame size={12} color={colors.neutral400} weight="fill" />
              <Typo size={11} color={colors.white}>
                {roundSafe(food.calories)} kCal
              </Typo>
            </View>
          </View>

          <View style={styles.macrosRow}>
            <View style={styles.macroTag}>
              <Icons.Drop size={12} color={PROTEIN_COLOR} weight="fill" />
              <Typo size={11} color={colors.white}>
                {roundSafe(food.protein)}g
              </Typo>
            </View>

            <View style={styles.macroTag}>
              <Icons.GrainsSlash size={12} color={CARBS_COLOR} weight="fill" />
              <Typo size={11} color={colors.white}>
                {roundSafe(food.carbs)}g
              </Typo>
            </View>

            <View style={styles.macroTag}>
              <Icons.Nut size={12} color={FAT_COLOR} weight="fill" />
              <Typo size={11} color={colors.white}>
                {roundSafe(food.fat)}g
              </Typo>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default React.memo(NutritionFoodRow);

const styles = StyleSheet.create({
  foodItem: {
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
    borderWidth: 0,
  },
  foodMainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  foodIconBox: {
    width: 32,
    height: 32,
    backgroundColor: colors.neutral900,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  foodContentColumn: {
    flex: 1,
    gap: 4,
  },
  foodMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 2,
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  macrosRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  macroTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
});
