import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Typo from "@/src/components/ui/Typo";
import { useLanguage } from "@/src/contexts/languageContext";
import { getMealLabel } from "@/src/i18n/translations";
import React, { useMemo } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import * as Icons from "phosphor-react-native";
import { EditableFoodState } from "./NutritionEditQuantityModal";

type NutritionFoodActionsModalProps = {
  visible: boolean;
  actionFood: EditableFoodState;
  meals: string[];
  bottomInset: number;
  onClose: () => void;
  onCopy: (toMeal: string) => void;
  onMove: (toMeal: string) => void;
  onDelete: () => void;
};

const NutritionFoodActionsModal = ({
  visible,
  actionFood,
  meals,
  bottomInset,
  onClose,
  onCopy,
  onMove,
  onDelete,
}: NutritionFoodActionsModalProps) => {
  const { language, t } = useLanguage();
  const actionsModalStyle = useMemo<ViewStyle>(
    () => ({
      bottom: spacingY._20,
      maxHeight: "78%",
      paddingBottom: bottomInset + spacingY._10,
    }),
    [bottomInset],
  );
  const availableMeals = useMemo(
    () => meals.filter((meal) => meal !== actionFood?.mealName),
    [actionFood?.mealName, meals],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.actionsOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.actionsModal, actionsModalStyle]}>
          {actionFood && (
            <>
              <View style={styles.actionsHeader}>
                <Typo size={18} fontWeight="700">
                  {actionFood.food.name}
                </Typo>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.actionsScrollContent}
              >
                <View style={styles.actionsList}>
                  <View style={styles.actionGroup}>
                    <Typo
                      size={15}
                      fontWeight="600"
                      color={colors.neutral400}
                      style={styles.actionGroupTitle}
                    >
                      {t("nutrition_copy_to")}
                    </Typo>
                    {availableMeals.map((meal, idx) => (
                      <TouchableOpacity
                        key={`copy-${idx}`}
                        style={styles.actionButton}
                        onPress={() => onCopy(meal)}
                      >
                        <Icons.Copy size={20} color={colors.primary} weight="bold" />
                        <Typo size={16} fontWeight="500">
                          {getMealLabel(language, meal)}
                        </Typo>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.actionGroup}>
                    <Typo
                      size={15}
                      fontWeight="600"
                      color={colors.neutral400}
                      style={styles.actionGroupTitle}
                    >
                      {t("nutrition_move_to")}
                    </Typo>
                    {availableMeals.map((meal, idx) => (
                      <TouchableOpacity
                        key={`move-${idx}`}
                        style={styles.actionButton}
                        onPress={() => onMove(meal)}
                      >
                        <Icons.ArrowsDownUp size={20} color={colors.green} weight="bold" />
                        <Typo size={16} fontWeight="500">
                          {getMealLabel(language, meal)}
                        </Typo>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteAction]}
                    onPress={onDelete}
                  >
                    <Icons.Trash size={20} color={colors.rose} weight="bold" />
                    <Typo size={16} fontWeight="600" color={colors.rose}>
                      {t("nutrition_delete_food")}
                    </Typo>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default React.memo(NutritionFoodActionsModal);

const styles = StyleSheet.create({
  actionsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  actionsModal: {
    position: "absolute",
    left: spacingX._20,
    right: spacingX._20,
    backgroundColor: colors.neutral900,
    borderRadius: radius._17,
    padding: spacingX._20,
    maxHeight: "70%",
  },
  actionsHeader: {
    paddingBottom: spacingY._15,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral700,
    marginBottom: spacingY._15,
  },
  actionsList: {
    gap: spacingY._20,
  },
  actionsScrollContent: {
    paddingBottom: spacingY._5,
  },
  actionGroup: {
    gap: spacingY._10,
  },
  actionGroupTitle: {
    marginBottom: spacingY._10,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    backgroundColor: colors.neutral800,
    padding: spacingX._15,
    borderRadius: radius._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  deleteAction: {
    borderColor: colors.rose,
    marginTop: spacingY._10,
  },
});
