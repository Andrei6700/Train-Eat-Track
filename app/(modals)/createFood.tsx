import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useNutrition } from "@/src/contexts/nutritionContext";
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

type MeasurementUnit = "Grame" | "Mililitri";

const CreateFood = () => {
  const router = useRouter();
  const { mealName } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { addFoodToMeal } = useNutrition();

  const [foodName, setFoodName] = useState("");
  const [measurementUnit, setMeasurementUnit] =
    useState<MeasurementUnit>("Grame");

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

  const handleSave = async () => {
    // Validation
    if (!foodName.trim()) {
      Alert.alert("Eroare", "Te rog introdu numele alimentului");
      return;
    }

    if (!energyValue || parseFloat(energyValue) <= 0) {
      Alert.alert("Eroare", "Te rog introdu valoarea energetică");
      return;
    }

    if (!totalFat || parseFloat(totalFat) < 0) {
      Alert.alert("Eroare", "Te rog introdu valoarea grăsimilor");
      return;
    }

    if (!totalCarbs || parseFloat(totalCarbs) < 0) {
      Alert.alert("Eroare", "Te rog introdu valoarea carbohidraților");
      return;
    }

    if (!protein || parseFloat(protein) < 0) {
      Alert.alert("Eroare", "Te rog introdu valoarea proteinelor");
      return;
    }

    setSaving(true);

    const foodData = {
      name: foodName,
      calories: Math.round(parseFloat(energyValue)),
      protein: Math.round(parseFloat(protein) * 10) / 10,
      carbs: Math.round(parseFloat(totalCarbs) * 10) / 10,
      fat: Math.round(parseFloat(totalFat) * 10) / 10,
      servingSize: `100${measurementUnit === "Grame" ? "g" : "ml"}`,
      // Additional info stored as metadata
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
        "Success",
        `${foodName} a fost creat și adăugat la ${mealName}!`,
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      setSaving(false);
      Alert.alert("Eroare", error?.message || "Nu s-a putut crea alimentul");
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
                Adaugă aliment
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
                  {mealName || "Masă"}
                </Typo>
              </Animated.View>

              {/* Food Name */}
              <Animated.View
                entering={FadeInDown.delay(250).duration(400)}
                style={styles.inputGroup}
              >
                <Typo size={15} fontWeight="600" style={styles.label}>
                  Numele alimentului*
                </Typo>
                <Input
                  placeholder="ex. Piept de pui gătit"
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
                  Unitatea de măsură
                </Typo>
                <View style={styles.unitToggle}>
                  <TouchableOpacity
                    style={[
                      styles.unitButton,
                      measurementUnit === "Grame" && styles.unitButtonActive,
                    ]}
                    onPress={() => setMeasurementUnit("Grame")}
                  >
                    <Typo
                      size={14}
                      fontWeight="600"
                      color={
                        measurementUnit === "Grame"
                          ? colors.black
                          : colors.white
                      }
                    >
                      Grame
                    </Typo>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.unitButton,
                      measurementUnit === "Mililitri" &&
                        styles.unitButtonActive,
                    ]}
                    onPress={() => setMeasurementUnit("Mililitri")}
                  >
                    <Typo
                      size={14}
                      fontWeight="600"
                      color={
                        measurementUnit === "Mililitri"
                          ? colors.black
                          : colors.white
                      }
                    >
                      Mililitri
                    </Typo>
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Nutritional Information Title */}
              <Animated.View entering={FadeInDown.delay(350).duration(400)}>
                <Typo size={18} fontWeight="700" style={styles.sectionTitle}>
                  Informații nutriționale pentru 100 de {measurementUnit}
                </Typo>
              </Animated.View>

              {/* Energy Value */}
              <Animated.View
                entering={FadeInDown.delay(400).duration(400)}
                style={styles.nutritionRow}
              >
                <View style={styles.nutritionLabel}>
                  <Typo size={15} fontWeight="500">
                    Valoare energetică *
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
                    Grăsimi/Lipide *
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
                    Grăsimi Saturate
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
                    Grăsimi Ne-Saturate
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
                    Carbohidrați/Glucide *
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
                    Zaharuri
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
                    Fibre
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
                    Proteine *
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
                    Sare
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
                  Câmpurile marcate cu * sunt obligatorii. Alimentul va fi
                  salvat pentru utilizări viitoare.
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
                  Creează și adaugă la {mealName}
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
