import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useLanguage } from "@/src/contexts/languageContext";
import { useNutrition } from "@/src/contexts/nutritionContext";
import { getMealLabel } from "@/src/i18n/translations";
import { verticalScale } from "@/src/utils/styling";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useState } from "react";
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import Animated, {
    FadeInDown,
    SlideInDown,
    SlideOutDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type MeasurementUnit = "grams" | "milliliters";

const CreateFood = () => {
  const router = useRouter();
  const { mealName } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { addFoodToMeal } = useNutrition();
  const { language, t } = useLanguage();
  const mealLabel = getMealLabel(language, mealName as string);

  const [foodName, setFoodName] = useState("");
  const [measurementUnit, setMeasurementUnit] =
    useState<MeasurementUnit>("grams");

  // Nutritional values per 100g/ml
  const [energyValue, setEnergyValue] = useState("");
  const [totalFat, setTotalFat] = useState("");
  const [saturatedFat, setSaturatedFat] = useState("");
  const [unsaturatedFat, setUnsaturatedFat] = useState("");
  const [totalCarbs, setTotalCarbs] = useState("");
  const [sugar, setSugar] = useState("");
  const [fiber, setFiber] = useState("");
  const [protein, setProtein] = useState("");
  const [salt, setSalt] = useState("");

  const [saving, setSaving] = useState(false);
  const measurementUnitLabel =
    measurementUnit === "grams"
      ? t("create_food_modal_unit_grams")
      : t("create_food_modal_unit_milliliters");

  const handleSave = async () => {
    if (!foodName.trim()) {
      Alert.alert(t("common_error"), t("create_food_modal_error_food_name"));
      return;
    }

    if (!energyValue || parseFloat(energyValue) <= 0) {
      Alert.alert(t("common_error"), t("create_food_modal_error_energy"));
      return;
    }

    if (!totalFat || parseFloat(totalFat) < 0) {
      Alert.alert(t("common_error"), t("create_food_modal_error_total_fat"));
      return;
    }

    if (!totalCarbs || parseFloat(totalCarbs) < 0) {
      Alert.alert(t("common_error"), t("create_food_modal_error_total_carbs"));
      return;
    }

    if (!protein || parseFloat(protein) < 0) {
      Alert.alert(t("common_error"), t("create_food_modal_error_protein"));
      return;
    }

    setSaving(true);

    const foodData = {
      name: foodName,
      calories: Math.round(parseFloat(energyValue)),
      protein: Math.round(parseFloat(protein) * 10) / 10,
      carbs: Math.round(parseFloat(totalCarbs) * 10) / 10,
      fat: Math.round(parseFloat(totalFat) * 10) / 10,
      servingSize: `100${measurementUnit === "grams" ? "g" : "ml"}`,
      metadata: {
        saturatedFat: parseFloat(saturatedFat) || 0,
        unsaturatedFat: parseFloat(unsaturatedFat) || 0,
        sugar: parseFloat(sugar) || 0,
        fiber: parseFloat(fiber) || 0,
        salt: parseFloat(salt) || 0,
      },
    };

    try {
      await addFoodToMeal(mealName as string, foodData);
      setSaving(false);
      Alert.alert(
        t("common_success"),
        t("create_food_modal_success_message", {
          food: foodName,
          meal: mealLabel,
        }),
        [
          {
            text: t("common_ok"),
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error: any) {
      setSaving(false);
      Alert.alert(
        t("common_error"),
        error?.message || t("create_food_modal_error_save"),
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardView}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <Animated.View
            entering={SlideInDown.duration(400).springify()}
            exiting={SlideOutDown.duration(300)}
            style={[styles.container, { paddingBottom: insets.bottom + 20 }]}
          >
            {/* Handle Bar */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()}>
                <Icons.XIcon size={24} color={colors.white} weight="bold" />
              </TouchableOpacity>
              <Typo size={20} fontWeight="700">
                {t("create_food_modal_title")}
              </Typo>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Meal Badge */}
              <Animated.View
                entering={FadeInDown.delay(200).duration(400)}
                style={styles.mealBadge}
              >
                <Icons.ForkKnifeIcon
                  size={20}
                  color={colors.primary}
                  weight="fill"
                />
                <Typo size={15} fontWeight="600">
                  {mealLabel || t("create_food_modal_meal_fallback")}
                </Typo>
              </Animated.View>

              {/* Food Name */}
              <Animated.View
                entering={FadeInDown.delay(250).duration(400)}
                style={styles.inputGroup}
              >
                <Typo size={15} fontWeight="600" style={styles.label}>
                  {t("create_food_modal_food_name_label")}
                </Typo>
                <Input
                  placeholder={t("create_food_modal_food_name_placeholder")}
                  value={foodName}
                  onChangeText={setFoodName}
                  containerStyle={styles.input}
                />
              </Animated.View>

              {/* Measurement Unit Toggle */}
              <Animated.View
                entering={FadeInDown.delay(300).duration(400)}
                style={styles.inputGroup}
              >
                <Typo size={15} fontWeight="600" style={styles.label}>
                  {t("create_food_modal_measurement_unit_label")}
                </Typo>
                <View style={styles.unitToggle}>
                  <TouchableOpacity
                    style={[
                      styles.unitButton,
                      measurementUnit === "grams" && styles.unitButtonActive,
                    ]}
                    onPress={() => setMeasurementUnit("grams")}
                  >
                    <Typo
                      size={14}
                      fontWeight="600"
                      color={
                        measurementUnit === "grams"
                          ? colors.black
                          : colors.white
                      }
                    >
                      {t("create_food_modal_unit_grams")}
                    </Typo>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.unitButton,
                      measurementUnit === "milliliters" &&
                        styles.unitButtonActive,
                    ]}
                    onPress={() => setMeasurementUnit("milliliters")}
                  >
                    <Typo
                      size={14}
                      fontWeight="600"
                      color={
                        measurementUnit === "milliliters"
                          ? colors.black
                          : colors.white
                      }
                    >
                      {t("create_food_modal_unit_milliliters")}
                    </Typo>
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Nutritional Information Title */}
              <Animated.View entering={FadeInDown.delay(350).duration(400)}>
                <Typo size={18} fontWeight="700" style={styles.sectionTitle}>
                  {t("create_food_modal_nutrition_title", { unit: measurementUnitLabel })}
                </Typo>
              </Animated.View>

              {/* Energy Value */}
              <Animated.View
                entering={FadeInDown.delay(400).duration(400)}
                style={styles.nutritionRow}
              >
                <View style={styles.nutritionLabel}>
                  <Typo size={15} fontWeight="500">
                    {t("create_food_modal_energy_label")}
                  </Typo>
                </View>
                <View style={styles.nutritionInputContainer}>
                  <Input
                    placeholder="0"
                    value={energyValue}
                    onChangeText={setEnergyValue}
                    keyboardType="numeric"
                    containerStyle={styles.nutritionInput}
                  />
                  <Typo size={14} color={colors.neutral400} style={styles.unit}>
                    kCal
                  </Typo>
                </View>
              </Animated.View>

              {/* Total Fat */}
              <Animated.View
                entering={FadeInDown.delay(450).duration(400)}
                style={styles.nutritionRow}
              >
                <View style={styles.nutritionLabel}>
                  <Typo size={15} fontWeight="500">
                    {t("create_food_modal_total_fat_label")}
                  </Typo>
                </View>
                <View style={styles.nutritionInputContainer}>
                  <Input
                    placeholder="0"
                    value={totalFat}
                    onChangeText={setTotalFat}
                    keyboardType="numeric"
                    containerStyle={styles.nutritionInput}
                  />
                  <Typo size={14} color={colors.neutral400} style={styles.unit}>
                    grame
                  </Typo>
                </View>
              </Animated.View>

              {/* Saturated Fat (Indented) */}
              <Animated.View
                entering={FadeInDown.delay(500).duration(400)}
                style={[styles.nutritionRow, styles.indentedRow]}
              >
                <View style={styles.nutritionLabel}>
                  <Typo size={14} color={colors.neutral400}>
                    {t("create_food_modal_saturated_fat_label")}
                  </Typo>
                </View>
                <View style={styles.nutritionInputContainer}>
                  <Input
                    placeholder="0"
                    value={saturatedFat}
                    onChangeText={setSaturatedFat}
                    keyboardType="numeric"
                    containerStyle={styles.nutritionInput}
                  />
                  <Typo size={14} color={colors.neutral400} style={styles.unit}>
                    grame
                  </Typo>
                </View>
              </Animated.View>

              {/* Unsaturated Fat (Indented) */}
              <Animated.View
                entering={FadeInDown.delay(550).duration(400)}
                style={[styles.nutritionRow, styles.indentedRow]}
              >
                <View style={styles.nutritionLabel}>
                  <Typo size={14} color={colors.neutral400}>
                    {t("create_food_modal_unsaturated_fat_label")}
                  </Typo>
                </View>
                <View style={styles.nutritionInputContainer}>
                  <Input
                    placeholder="0"
                    value={unsaturatedFat}
                    onChangeText={setUnsaturatedFat}
                    keyboardType="numeric"
                    containerStyle={styles.nutritionInput}
                  />
                  <Typo size={14} color={colors.neutral400} style={styles.unit}>
                    grame
                  </Typo>
                </View>
              </Animated.View>

              {/* Total Carbs */}
              <Animated.View
                entering={FadeInDown.delay(600).duration(400)}
                style={styles.nutritionRow}
              >
                <View style={styles.nutritionLabel}>
                  <Typo size={15} fontWeight="500">
                    {t("create_food_modal_total_carbs_label")}
                  </Typo>
                </View>
                <View style={styles.nutritionInputContainer}>
                  <Input
                    placeholder="0"
                    value={totalCarbs}
                    onChangeText={setTotalCarbs}
                    keyboardType="numeric"
                    containerStyle={styles.nutritionInput}
                  />
                  <Typo size={14} color={colors.neutral400} style={styles.unit}>
                    grame
                  </Typo>
                </View>
              </Animated.View>

              {/* Sugar (Indented) */}
              <Animated.View
                entering={FadeInDown.delay(650).duration(400)}
                style={[styles.nutritionRow, styles.indentedRow]}
              >
                <View style={styles.nutritionLabel}>
                  <Typo size={14} color={colors.neutral400}>
                    {t("create_food_modal_sugar_label")}
                  </Typo>
                </View>
                <View style={styles.nutritionInputContainer}>
                  <Input
                    placeholder="0"
                    value={sugar}
                    onChangeText={setSugar}
                    keyboardType="numeric"
                    containerStyle={styles.nutritionInput}
                  />
                  <Typo size={14} color={colors.neutral400} style={styles.unit}>
                    grame
                  </Typo>
                </View>
              </Animated.View>

              {/* Fiber */}
              <Animated.View
                entering={FadeInDown.delay(700).duration(400)}
                style={styles.nutritionRow}
              >
                <View style={styles.nutritionLabel}>
                  <Typo size={15} fontWeight="500">
                    {t("create_food_modal_fiber_label")}
                  </Typo>
                </View>
                <View style={styles.nutritionInputContainer}>
                  <Input
                    placeholder="0"
                    value={fiber}
                    onChangeText={setFiber}
                    keyboardType="numeric"
                    containerStyle={styles.nutritionInput}
                  />
                  <Typo size={14} color={colors.neutral400} style={styles.unit}>
                    grame
                  </Typo>
                </View>
              </Animated.View>

              {/* Protein */}
              <Animated.View
                entering={FadeInDown.delay(750).duration(400)}
                style={styles.nutritionRow}
              >
                <View style={styles.nutritionLabel}>
                  <Typo size={15} fontWeight="500">
                    {t("create_food_modal_protein_label")}
                  </Typo>
                </View>
                <View style={styles.nutritionInputContainer}>
                  <Input
                    placeholder="0"
                    value={protein}
                    onChangeText={setProtein}
                    keyboardType="numeric"
                    containerStyle={styles.nutritionInput}
                  />
                  <Typo size={14} color={colors.neutral400} style={styles.unit}>
                    grame
                  </Typo>
                </View>
              </Animated.View>

              {/* Salt */}
              <Animated.View
                entering={FadeInDown.delay(800).duration(400)}
                style={styles.nutritionRow}
              >
                <View style={styles.nutritionLabel}>
                  <Typo size={15} fontWeight="500">
                    {t("create_food_modal_salt_label")}
                  </Typo>
                </View>
                <View style={styles.nutritionInputContainer}>
                  <Input
                    placeholder="0"
                    value={salt}
                    onChangeText={setSalt}
                    keyboardType="numeric"
                    containerStyle={styles.nutritionInput}
                  />
                  <Typo size={14} color={colors.neutral400} style={styles.unit}>
                    miligrame
                  </Typo>
                </View>
              </Animated.View>

              {/* Info Note */}
              <Animated.View
                entering={FadeInDown.delay(850).duration(400)}
                style={styles.noteCard}
              >
                <Icons.InfoIcon
                  size={20}
                  color={colors.primary}
                  weight="fill"
                />
                <Typo size={13} color={colors.neutral400} style={{ flex: 1 }}>
                  {t("create_food_modal_note")}
                </Typo>
              </Animated.View>
            </ScrollView>

            {/* Footer Button */}
            <Animated.View
              entering={FadeInDown.delay(900).duration(400)}
              style={styles.footer}
            >
              <Button onPress={handleSave} loading={saving}>
                <Typo size={18} fontWeight="700" color={colors.black}>
                  {t("create_food_modal_create_and_add", { meal: mealLabel || t("create_food_modal_meal_fallback") })}
                </Typo>
              </Button>
            </Animated.View>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default CreateFood;

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: colors.neutral900,
    borderTopLeftRadius: radius._20,
    borderTopRightRadius: radius._20,
    maxHeight: "95%",
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacingX._20,
    marginBottom: spacingY._20,
  },
  scrollContent: {
    paddingHorizontal: spacingX._20,
    paddingBottom: spacingY._20,
  },
  mealBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    padding: spacingX._15,
    marginBottom: spacingY._20,
    alignSelf: "flex-start",
  },
  inputGroup: {
    marginBottom: spacingY._20,
  },
  label: {
    marginBottom: spacingY._10,
  },
  input: {
    backgroundColor: colors.neutral800,
  },
  unitToggle: {
    flexDirection: "row",
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    padding: 4,
    gap: 4,
  },
  unitButton: {
    flex: 1,
    paddingVertical: spacingY._12,
    alignItems: "center",
    borderRadius: radius._10,
  },
  unitButtonActive: {
    backgroundColor: colors.primary,
  },
  sectionTitle: {
    marginBottom: spacingY._15,
    marginTop: spacingY._10,
  },
  nutritionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacingY._12,
    gap: spacingX._15,
  },
  indentedRow: {
    paddingLeft: spacingX._20,
  },
  nutritionLabel: {
    flex: 1,
  },
  nutritionInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    minWidth: 140,
  },
  nutritionInput: {
    flex: 1,
    backgroundColor: colors.neutral800,
    height: verticalScale(45),
  },
  unit: {
    minWidth: 60,
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacingX._10,
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    padding: spacingX._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
    marginTop: spacingY._15,
  },
  footer: {
    paddingHorizontal: spacingX._20,
    paddingTop: spacingY._15,
    borderTopWidth: 1,
    borderTopColor: colors.neutral700,
  },
});
