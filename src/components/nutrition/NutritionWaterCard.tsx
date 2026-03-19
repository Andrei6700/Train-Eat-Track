import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Typo from "@/src/components/ui/Typo";
import { useLanguage } from "@/src/contexts/languageContext";
import WaterWave from "@/src/components/ui/WaterWave";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Icons from "phosphor-react-native";

type NutritionWaterCardProps = {
  waterPercentage: number;
  total: number;
  goal: number;
  onResetWater: () => void;
  onAddWater: (amount: number) => void;
};

const NutritionWaterCard = ({
  waterPercentage,
  total,
  goal,
  onResetWater,
  onAddWater,
}: NutritionWaterCardProps) => {
  const { t } = useLanguage();
  return (
    <Animated.View
      entering={FadeInDown.duration(400).delay(200)}
      style={styles.cardOuter}
    >
      <View style={styles.cardShadow} />
      <View style={styles.waterCard}>
        <View style={styles.waterHeader}>
          <Icons.Drop size={24} color={colors.primary} weight="fill" />
          <Typo size={20} fontWeight="600" style={styles.waterTitle}>
            {t("nutrition_water_intake")}
          </Typo>
          <TouchableOpacity onPress={onResetWater}>
            <Icons.ArrowCounterClockwise size={20} color={colors.neutral400} />
          </TouchableOpacity>
        </View>

        <View style={styles.waterContent}>
          <WaterWave percentage={waterPercentage} total={total} goal={goal} />

          <View style={styles.waterButtons}>
            <TouchableOpacity
              style={styles.waterButton}
              onPress={() => onAddWater(250)}
            >
              <Typo size={14} fontWeight="600" color={colors.black}>
                + 250 ml
              </Typo>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.waterButton}
              onPress={() => onAddWater(500)}
            >
              <Typo size={14} fontWeight="600" color={colors.black}>
                + 500 ml
              </Typo>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.waterButton}
              onPress={() => onAddWater(750)}
            >
              <Typo size={14} fontWeight="600" color={colors.black}>
                + 750 ml
              </Typo>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

export default React.memo(NutritionWaterCard);

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
  waterCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    borderWidth: 2,
    borderColor: colors.neutral700,
  },
  waterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    marginBottom: spacingY._20,
  },
  waterTitle: {
    flex: 1,
  },
  waterContent: {
    alignItems: "center",
    gap: spacingY._20,
  },
  waterButtons: {
    flexDirection: "row",
    gap: spacingX._10,
    width: "100%",
    justifyContent: "center",
  },
  waterButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._20,
    borderRadius: radius._12,
  },
});

