import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import useReduceMotion from "@/src/hooks/useReduceMotion";
import Typo from "@/src/components/ui/Typo";
import WaterWave from "@/src/components/ui/WaterWave";
import { useLanguage } from "@/src/contexts/languageContext";
import { WaterIntake } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import * as Icons from "phosphor-react-native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

type NutritionWaterCardProps = {
  waterPercentage: number;
  total: number;
  goal: number;
  onResetWater: () => void;
  onAddWater: (amount: number) => void;
  intakes: WaterIntake[];
  onRemoveWater: (index: number) => void;
};

const NutritionWaterCard = ({
  waterPercentage,
  total,
  goal,
  onResetWater,
  onAddWater,
  intakes = [],
  onRemoveWater,
}: NutritionWaterCardProps) => {
  const { t, language } = useLanguage();
  const reduceMotion = useReduceMotion();

  // Sort intakes chronologically (ascending time) while keeping their original index
  const sortedIntakesWithIndex = React.useMemo(() => {
    return intakes
      .map((intake, index) => ({ intake, index }))
      .sort(
        (a, b) =>
          new Date(a.intake.timestamp).getTime() -
          new Date(b.intake.timestamp).getTime(),
      );
  }, [intakes]);

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(400).delay(200)}
      style={styles.cardOuter}
    >
      <View style={styles.cardShadow} />
      <View style={styles.waterCard}>
        <View style={styles.waterHeader}>
          <Icons.Drop size={24} color={colors.primary} weight="fill" />
          <Typo size={20} variant="heading" style={styles.waterTitle}>
            {t("nutrition_water_intake")}
          </Typo>
          <Pressable
            onPress={onResetWater}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t("nutrition_reset_water_title")}
          >
            <Icons.ArrowCounterClockwise size={20} color={colors.neutral400} />
          </Pressable>
        </View>

        <View style={styles.waterContent}>
          <WaterWave
            percentage={waterPercentage}
            total={total}
            goal={goal}
            size={140}
          />

          <View style={styles.waterButtons}>
            <Pressable
              style={({ pressed }) => [styles.waterButtonPrimary, pressed && styles.pressed]}
              onPress={() => onAddWater(250)}
              accessibilityRole="button"
              accessibilityLabel="Add 250 ml water"
            >
              <Typo size={14} fontWeight="600" color={colors.black}>
                + 250 ml
              </Typo>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.waterButton, pressed && styles.pressed]}
              onPress={() => onAddWater(500)}
              accessibilityRole="button"
              accessibilityLabel="Add 500 ml water"
            >
              <Typo size={14} fontWeight="600" color={colors.textPrimary}>
                + 500 ml
              </Typo>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.waterButton, pressed && styles.pressed]}
              onPress={() => onAddWater(750)}
              accessibilityRole="button"
              accessibilityLabel="Add 750 ml water"
            >
              <Typo size={14} fontWeight="600" color={colors.textPrimary}>
                + 750 ml
              </Typo>
            </Pressable>
          </View>

          {/* Chronological list of water entries */}
          {sortedIntakesWithIndex.length > 0 && (
            <View style={styles.entriesList}>
              {sortedIntakesWithIndex.map((item) => {
                const date = new Date(item.intake.timestamp);
                const timeString = date.toLocaleTimeString(
                  language === "ro" ? "ro-RO" : "en-US",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  },
                );

                return (
                  <View key={item.index} style={styles.entryRow}>
                    {/* Bullet Indicator */}
                    <View style={styles.bulletIndicator} />

                    {/* Entry Details */}
                    <View style={styles.entryDetails}>
                      <Typo size={16} fontWeight="600" color={colors.textPrimary}>
                        {item.intake.amount} ml
                      </Typo>
                      <View style={styles.timeRow}>
                        <Icons.Clock
                          size={12}
                          color={colors.neutral400}
                          style={styles.timeIcon}
                        />
                        <Typo size={12} color={colors.neutral400}>
                          {timeString}
                        </Typo>
                      </View>
                    </View>

                    {/* Delete Button */}
                    <Pressable
                      style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => onRemoveWater(item.index)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete water log ${item.intake.amount} ml`}
                    >
                      <Icons.Trash
                        size={20}
                        color={colors.rose}
                        weight="fill"
                      />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
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
    backgroundColor: colors.black,
    opacity: 0.25,
    borderRadius: radius._17,
  },
  waterCard: {
    backgroundColor: colors.surface,
    borderRadius: radius._17,
    padding: spacingX._15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  waterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    marginBottom: spacingY._15,
  },
  waterTitle: {
    flex: 1,
  },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  waterContent: {
    alignItems: "center",
    gap: spacingY._15,
  },
  waterButtons: {
    flexDirection: "row",
    gap: spacingX._10,
    width: "100%",
    justifyContent: "center",
  },
  waterButtonPrimary: {
    backgroundColor: colors.primary,
    minHeight: 48,
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._15,
    borderRadius: radius._12,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  waterButton: {
    backgroundColor: colors.surfaceRaised,
    minHeight: 48,
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._15,
    borderRadius: radius._12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  entriesList: {
    width: "100%",
    marginTop: spacingY._15,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacingY._15,
    gap: spacingY._12,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: spacingY._5,
  },
  bulletIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.waterAccent,
    marginRight: spacingX._12,
  },
  entryDetails: {
    flex: 1,
    gap: 2,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeIcon: {
    marginRight: 2,
  },
  deleteButton: {
    padding: spacingX._10,
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
