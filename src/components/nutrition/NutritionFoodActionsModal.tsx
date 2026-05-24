import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Typo from "@/src/components/ui/Typo";
import { useLanguage } from "@/src/contexts/languageContext";
import { getMealLabel } from "@/src/i18n/translations";
import { verticalScale } from "@/src/utils/styling";
import React, { useCallback, useMemo, useState } from "react";
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import * as Icons from "phosphor-react-native";
import { EditableFoodState } from "./NutritionEditQuantityModal";

type ActionMode = "move" | "copy";

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
  const [mode, setMode] = useState<ActionMode>("move");

  const actionsModalStyle = useMemo<ViewStyle>(
    () => ({
      paddingBottom: bottomInset + spacingY._10,
    }),
    [bottomInset],
  );

  const availableMeals = useMemo(
    () => meals.filter((meal) => meal !== actionFood?.mealName),
    [actionFood?.mealName, meals],
  );

  const handleMealAction = useCallback(
    (meal: string) => {
      if (mode === "move") {
        onMove(meal);
      } else {
        onCopy(meal);
      }
    },
    [mode, onCopy, onMove],
  );

  const handleClose = useCallback(() => {
    setMode("move");
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <View
          style={[styles.modal, actionsModalStyle]}
          onStartShouldSetResponder={() => true}
        >
          {actionFood && (
            <>
              {/* Handle bar */}
              <View style={styles.handleBar} />

              {/* Food name */}
              <View style={styles.header}>
                <Typo size={18} fontWeight="700" textProps={{ numberOfLines: 2 }}>
                  {actionFood.food.name}
                </Typo>
              </View>

              {/* Mode Toggle: Move / Copy */}
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[styles.modeButton, mode === "move" && styles.modeButtonActive]}
                  onPress={() => setMode("move")}
                  activeOpacity={0.7}
                >
                  <Icons.ArrowsDownUp
                    size={verticalScale(18)}
                    color={mode === "move" ? colors.black : colors.neutral400}
                    weight="bold"
                  />
                  <Typo
                    size={14}
                    fontWeight="600"
                    color={mode === "move" ? colors.black : colors.neutral400}
                  >
                    {t("nutrition_move_to").replace(":", "")}
                  </Typo>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeButton, mode === "copy" && styles.modeButtonActive]}
                  onPress={() => setMode("copy")}
                  activeOpacity={0.7}
                >
                  <Icons.Copy
                    size={verticalScale(18)}
                    color={mode === "copy" ? colors.black : colors.neutral400}
                    weight="bold"
                  />
                  <Typo
                    size={14}
                    fontWeight="600"
                    color={mode === "copy" ? colors.black : colors.neutral400}
                  >
                    {t("nutrition_copy_to").replace(":", "")}
                  </Typo>
                </TouchableOpacity>
              </View>

              {/* Meal buttons */}
              <View style={styles.mealList}>
                {availableMeals.map((meal) => (
                  <TouchableOpacity
                    key={meal}
                    style={styles.mealButton}
                    onPress={() => handleMealAction(meal)}
                    activeOpacity={0.7}
                  >
                    {mode === "move" ? (
                      <Icons.ArrowRight
                        size={verticalScale(20)}
                        color={colors.primary}
                        weight="bold"
                      />
                    ) : (
                      <Icons.CopySimple
                        size={verticalScale(20)}
                        color={colors.primary}
                        weight="bold"
                      />
                    )}
                    <Typo size={16} fontWeight="500">
                      {getMealLabel(language, meal)}
                    </Typo>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Separator */}
              <View style={styles.separator} />

              {/* Delete */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={onDelete}
                activeOpacity={0.7}
              >
                <Icons.Trash size={verticalScale(20)} color={colors.rose} weight="bold" />
                <Typo size={16} fontWeight="600" color={colors.rose}>
                  {t("nutrition_delete_food")}
                </Typo>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default React.memo(NutritionFoodActionsModal);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    marginHorizontal: spacingX._15,
    backgroundColor: colors.neutral900,
    borderRadius: radius._20,
    paddingHorizontal: spacingX._20,
    paddingTop: spacingY._10,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.neutral600,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacingY._15,
  },
  header: {
    marginBottom: spacingY._15,
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    padding: 4,
    gap: 4,
    marginBottom: spacingY._15,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._7,
    paddingVertical: spacingY._10,
    borderRadius: radius._10,
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
  },
  mealList: {
    gap: spacingY._10,
    marginBottom: spacingY._5,
  },
  mealButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    backgroundColor: colors.neutral800,
    padding: spacingX._15,
    borderRadius: radius._12,
    borderWidth: 1.5,
    borderColor: colors.neutral700,
  },
  separator: {
    height: 1,
    backgroundColor: colors.neutral700,
    marginVertical: spacingY._12,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    backgroundColor: colors.neutral800,
    padding: spacingX._15,
    borderRadius: radius._12,
    borderWidth: 1.5,
    borderColor: colors.rose,
  },
});
