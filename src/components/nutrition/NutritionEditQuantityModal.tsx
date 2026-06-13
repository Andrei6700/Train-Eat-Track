import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useLanguage } from "@/src/contexts/languageContext";
import React, { useMemo } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import * as Icons from "phosphor-react-native";
import { FoodWithBrand } from "./NutritionFoodRow";

export type EditableFoodState = {
  mealName: string;
  foodIndex: number;
  food: FoodWithBrand;
} | null;

type NutritionEditQuantityModalProps = {
  visible: boolean;
  editingFood: EditableFoodState;
  editQuantity: string;
  bottomInset: number;
  onClose: () => void;
  onChangeQuantity: (value: string) => void;
  onSave: () => void;
};

const parseSafe = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const NutritionEditQuantityModal = ({
  visible,
  editingFood,
  editQuantity,
  bottomInset,
  onClose,
  onChangeQuantity,
  onSave,
}: NutritionEditQuantityModalProps) => {
  const { t } = useLanguage();
  const quantityValue = parseSafe(editQuantity);
  const editModalStyle = useMemo<ViewStyle>(
    () => ({ paddingBottom: bottomInset + 20 }),
    [bottomInset],
  );

  const adjustedValues = useMemo(() => {
    if (!editingFood) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }

    const oldQuantity = Number.parseFloat(editingFood.food.servingSize) || 100;
    const multiplier = oldQuantity > 0 ? quantityValue / oldQuantity : 1;
    return {
      calories: Math.round(editingFood.food.calories * multiplier),
      protein: Math.round(editingFood.food.protein * multiplier * 10) / 10,
      carbs: Math.round(editingFood.food.carbs * multiplier * 10) / 10,
      fat: Math.round(editingFood.food.fat * multiplier * 10) / 10,
    };
  }, [editingFood, quantityValue]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />

        <View style={[styles.editModal, editModalStyle]}>
          <View style={styles.handleBar} />

          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Icons.X size={24} color={colors.white} weight="bold" />
            </TouchableOpacity>
            <Typo size={20} fontWeight="700">
              {t("nutrition_edit_quantity")}
            </Typo>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
          >
            {editingFood && (
              <View style={styles.modalContent}>
                <View style={styles.foodInfo}>
                  <Typo size={18} fontWeight="700" style={styles.centerText}>
                    {editingFood.food.name}
                  </Typo>
                  <Typo size={14} color={colors.neutral400} style={styles.foodMealLabel}>
                    {editingFood.mealName}
                  </Typo>
                </View>

                <View style={styles.quantitySection}>
                  <Typo size={16} fontWeight="600" style={styles.quantityTitle}>
                    {t("nutrition_quantity_grams")}
                  </Typo>
                  <Input
                    placeholder="100"
                    value={editQuantity}
                    onChangeText={onChangeQuantity}
                    keyboardType="numeric"
                    containerStyle={styles.quantityInput}
                  />
                </View>

                <View style={styles.adjustedNutrition}>
                  <Typo size={15} fontWeight="600" style={styles.adjustedTitle}>
                    {t("nutrition_calculated_values_for", { value: editQuantity || "0" })}
                  </Typo>

                  <View style={styles.nutritionGrid}>
                    <View style={styles.nutritionItem}>
                      <Typo size={24} fontWeight="700" color={colors.primary}>
                        {adjustedValues.calories}
                      </Typo>
                      <Typo size={12} color={colors.neutral400}>
                        kcal
                      </Typo>
                    </View>

                    <View style={styles.nutritionItem}>
                      <Typo size={20} fontWeight="600">
                        {adjustedValues.protein}g
                      </Typo>
                      <Typo size={12} color={colors.neutral400}>
                        {t("nutrition_protein")}
                      </Typo>
                    </View>

                    <View style={styles.nutritionItem}>
                      <Typo size={20} fontWeight="600">
                        {adjustedValues.carbs}g
                      </Typo>
                      <Typo size={12} color={colors.neutral400}>
                        {t("nutrition_carbs")}
                      </Typo>
                    </View>

                    <View style={styles.nutritionItem}>
                      <Typo size={20} fontWeight="600">
                        {adjustedValues.fat}g
                      </Typo>
                      <Typo size={12} color={colors.neutral400}>
                        {t("nutrition_fat")}
                      </Typo>
                    </View>
                  </View>
                </View>

                <Button onPress={onSave} style={styles.saveButton}>
                  <Typo size={18} fontWeight="700" color={colors.black}>
                    {t("common_save")}
                  </Typo>
                </Button>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default React.memo(NutritionEditQuantityModal);

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  editModal: {
    backgroundColor: colors.neutral900,
    borderTopLeftRadius: radius._20,
    borderTopRightRadius: radius._20,
    maxHeight: "85%",
    paddingTop: spacingY._15,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.neutral600,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacingY._15,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacingX._20,
    marginBottom: spacingY._20,
  },
  modalHeaderSpacer: {
    width: 24,
  },
  modalContent: {
    paddingHorizontal: spacingX._20,
  },
  foodInfo: {
    alignItems: "center",
    marginBottom: spacingY._25,
  },
  centerText: {
    textAlign: "center",
  },
  foodMealLabel: {
    textAlign: "center",
    marginTop: spacingY._5,
  },
  quantitySection: {
    marginBottom: spacingY._25,
  },
  quantityTitle: {
    marginBottom: spacingY._12,
  },
  quantityInput: {
    backgroundColor: colors.neutral800,
  },
  adjustedNutrition: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    borderWidth: 2,
    borderColor: colors.neutral700,
  },
  adjustedTitle: {
    marginBottom: spacingY._12,
  },
  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacingX._15,
    justifyContent: "space-between",
  },
  nutritionItem: {
    alignItems: "center",
    width: "45%",
    backgroundColor: colors.neutral900,
    padding: spacingX._15,
    borderRadius: radius._12,
  },
  saveButton: {
    marginTop: spacingY._20,
  },
});

