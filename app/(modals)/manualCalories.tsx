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

const ManualCalories = () => {
  const router = useRouter();
  const { mealName } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { addFoodToMeal } = useNutrition();

  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");
  const [proteins, setProteins] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [description, setDescription] = useState("");
  const [autoCalculate, setAutoCalculate] = useState(false);
  const [isPer100g, setIsPer100g] = useState(false);
  const [servingAmount, setServingAmount] = useState("");
  const [saving, setSaving] = useState(false);

  // Calculează automat caloriile bazat pe macronutrienți
  const calculateCalories = () => {
    const p = parseFloat(proteins) || 0;
    const c = parseFloat(carbs) || 0;
    const f = parseFloat(fats) || 0;

    // Proteine: 4 kcal/g, Carbohidrați: 4 kcal/g, Grăsimi: 9 kcal/g
    const totalCal = p * 4 + c * 4 + f * 9;
    setCalories(Math.round(totalCal).toString());
  };

  React.useEffect(() => {
    if (autoCalculate && (proteins || carbs || fats)) {
      calculateCalories();
    }
  }, [proteins, carbs, fats, autoCalculate]);

  const handleSave = async () => {
    if (!foodName.trim()) {
      Alert.alert("Eroare", "Te rog introdu numele alimentului");
      return;
    }

    if (!calories || parseFloat(calories) <= 0) {
      Alert.alert("Eroare", "Te rog introdu un număr valid de calorii");
      return;
    }

    // Dacă este per 100g și user-ul a introdus cantitate
    let finalCalories = parseFloat(calories);
    let finalProteins = parseFloat(proteins) || 0;
    let finalCarbs = parseFloat(carbs) || 0;
    let finalFats = parseFloat(fats) || 0;

    if (isPer100g && servingAmount) {
      const amount = parseFloat(servingAmount);
      if (amount > 0) {
        const multiplier = amount / 100;
        finalCalories = finalCalories * multiplier;
        finalProteins = finalProteins * multiplier;
        finalCarbs = finalCarbs * multiplier;
        finalFats = finalFats * multiplier;
      }
    }

    setSaving(true);

    const foodData = {
      name: foodName,
      calories: Math.round(finalCalories),
      protein: Math.round(finalProteins * 10) / 10,
      carbs: Math.round(finalCarbs * 10) / 10,
      fat: Math.round(finalFats * 10) / 10,
      servingSize: isPer100g && servingAmount ? `${servingAmount}g` : "100g",
    };

    try {
      await addFoodToMeal(mealName as string, foodData);
      setSaving(false);
      Alert.alert("Success", "Alimentul a fost adăugat!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      setSaving(false);
      Alert.alert("Eroare", error?.message || "Nu s-a putut adăuga alimentul");
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
                <Icons.X size={24} color={colors.white} weight="bold" />
              </TouchableOpacity>
              <Typo size={20} fontWeight="700">
                Introdu Calorii
              </Typo>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Info Card */}
              <Animated.View
                entering={FadeInDown.delay(200).duration(400)}
                style={styles.infoCard}
              >
                <Typo size={14} color={colors.neutral400}>
                  Folosește formularul de mai jos dacă vrei să adaugi rapid o
                  intrare în jurnal cu un anumit număr de calorii, grăsimi,
                  proteine sau carbohidrați.
                </Typo>
              </Animated.View>

              {/* Meal Badge */}
              <Animated.View
                entering={FadeInDown.delay(250).duration(400)}
                style={styles.mealBadge}
              >
                <Icons.ForkKnife
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
                entering={FadeInDown.delay(300).duration(400)}
                style={styles.inputGroup}
              >
                <Typo size={15} fontWeight="600" style={styles.label}>
                  Numele alimentului*
                </Typo>
                <Input
                  placeholder="ex. Piept de pui"
                  value={foodName}
                  onChangeText={setFoodName}
                  containerStyle={styles.input}
                />
              </Animated.View>

              {/* Calories */}
              <Animated.View
                entering={FadeInDown.delay(350).duration(400)}
                style={styles.inputGroup}
              >
                <Typo size={15} fontWeight="600" style={styles.label}>
                  Calorii (kCal) *
                </Typo>
                <Input
                  placeholder="0"
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="numeric"
                  containerStyle={styles.input}
                  editable={!autoCalculate}
                  inputStyle={autoCalculate && styles.disabledInput}
                />
              </Animated.View>

              {/* Macronutrients */}
              <Animated.View
                entering={FadeInDown.delay(400).duration(400)}
                style={styles.macrosSection}
              >
                <Typo size={16} fontWeight="600" style={styles.sectionTitle}>
                  Macronutrienți (opțional)
                </Typo>

                {/* Proteins */}
                <View style={styles.macroRow}>
                  <View
                    style={[styles.macroIcon, { backgroundColor: "#3B33C4" }]}
                  >
                    <Icons.Flame size={18} color={colors.white} weight="fill" />
                  </View>
                  <View style={styles.macroInputContainer}>
                    <Typo size={14} color={colors.neutral400}>
                      Proteine (g)
                    </Typo>
                    <Input
                      placeholder="0"
                      value={proteins}
                      onChangeText={setProteins}
                      keyboardType="numeric"
                      containerStyle={styles.macroInput}
                    />
                  </View>
                </View>

                {/* Carbs */}
                <View style={styles.macroRow}>
                  <View
                    style={[styles.macroIcon, { backgroundColor: "#10B981" }]}
                  >
                    <Icons.Bread size={18} color={colors.white} weight="fill" />
                  </View>
                  <View style={styles.macroInputContainer}>
                    <Typo size={14} color={colors.neutral400}>
                      Carbohidrați (g)
                    </Typo>
                    <Input
                      placeholder="0"
                      value={carbs}
                      onChangeText={setCarbs}
                      keyboardType="numeric"
                      containerStyle={styles.macroInput}
                    />
                  </View>
                </View>

                {/* Fats */}
                <View style={styles.macroRow}>
                  <View
                    style={[styles.macroIcon, { backgroundColor: "#B413BF" }]}
                  >
                    <Icons.Drop size={18} color={colors.white} weight="fill" />
                  </View>
                  <View style={styles.macroInputContainer}>
                    <Typo size={14} color={colors.neutral400}>
                      Grăsimi (g)
                    </Typo>
                    <Input
                      placeholder="0"
                      value={fats}
                      onChangeText={setFats}
                      keyboardType="numeric"
                      containerStyle={styles.macroInput}
                    />
                  </View>
                </View>
              </Animated.View>

              {/* Auto Calculate Toggle */}
              <Animated.View entering={FadeInDown.delay(450).duration(400)}>
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => setAutoCalculate(!autoCalculate)}
                  activeOpacity={0.7}
                >
                  <View style={styles.toggleLeft}>
                    <Icons.Calculator
                      size={20}
                      color={colors.primary}
                      weight="fill"
                    />
                    <View style={styles.toggleText}>
                      <Typo size={15} fontWeight="600">
                        Calculează automat caloriile
                      </Typo>
                      <Typo size={12} color={colors.neutral400}>
                        Calculul se va face în funcție de valorile introduse la
                        grăsimi, carbohidrați și proteine.
                      </Typo>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.toggle,
                      autoCalculate && styles.toggleActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleCircle,
                        autoCalculate && styles.toggleCircleActive,
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              </Animated.View>

              {/* Per 100g Toggle */}
              <Animated.View entering={FadeInDown.delay(500).duration(400)}>
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => setIsPer100g(!isPer100g)}
                  activeOpacity={0.7}
                >
                  <View style={styles.toggleLeft}>
                    <Icons.Scales
                      size={20}
                      color={colors.primary}
                      weight="fill"
                    />
                    <View style={styles.toggleText}>
                      <Typo size={15} fontWeight="600">
                        Valorile sunt pentru 100 de grame
                      </Typo>
                      <Typo size={12} color={colors.neutral400}>
                        Dacă valorile introduse sunt pentru 100 de grame,
                        bifează acest câmp și introdu cantitatea consumată
                        pentru a calcula valorile nutriționale
                      </Typo>
                    </View>
                  </View>
                  <View
                    style={[styles.toggle, isPer100g && styles.toggleActive]}
                  >
                    <View
                      style={[
                        styles.toggleCircle,
                        isPer100g && styles.toggleCircleActive,
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              </Animated.View>

              {/* Serving Amount (shown only if isPer100g) */}
              {isPer100g && (
                <Animated.View
                  entering={FadeInDown.delay(550).duration(400)}
                  style={styles.inputGroup}
                >
                  <Typo size={15} fontWeight="600" style={styles.label}>
                    Cantitate consumată (g)
                  </Typo>
                  <Input
                    placeholder="ex. 150"
                    value={servingAmount}
                    onChangeText={setServingAmount}
                    keyboardType="numeric"
                    containerStyle={styles.input}
                  />
                </Animated.View>
              )}

              {/* Description */}
              <Animated.View
                entering={FadeInDown.delay(600).duration(400)}
                style={styles.inputGroup}
              >
                <Typo size={15} fontWeight="600" style={styles.label}>
                  Descriere (opțional)
                </Typo>
                <Input
                  placeholder="Adaugă o descriere..."
                  value={description}
                  onChangeText={setDescription}
                  containerStyle={styles.textAreaInput}
                  multiline
                  numberOfLines={3}
                  inputStyle={styles.textArea}
                />
              </Animated.View>

              {/* Note */}
              <Animated.View
                entering={FadeInDown.delay(650).duration(400)}
                style={styles.noteCard}
              >
                <Icons.Info size={20} color={colors.primary} weight="fill" />
                <Typo size={13} color={colors.neutral400} style={{ flex: 1 }}>
                  Notă: Trebuie să introduci o valoare pentru cel puțin unul din
                  câmpuri
                </Typo>
              </Animated.View>
            </ScrollView>

            {/* Footer Button */}
            <Animated.View
              entering={FadeInDown.delay(700).duration(400)}
              style={styles.footer}
            >
              <Button onPress={handleSave} loading={saving}>
                <Typo size={18} fontWeight="700" color={colors.black}>
                  Adaugă la {mealName}
                </Typo>
              </Button>
            </Animated.View>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default ManualCalories;

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
  infoCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    padding: spacingX._15,
    marginBottom: spacingY._20,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: "dashed",
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
  disabledInput: {
    opacity: 0.5,
  },
  macrosSection: {
    marginBottom: spacingY._20,
  },
  sectionTitle: {
    marginBottom: spacingY._15,
  },
  macroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    marginBottom: spacingY._12,
  },
  macroIcon: {
    width: verticalScale(40),
    height: verticalScale(40),
    borderRadius: radius._10,
    alignItems: "center",
    justifyContent: "center",
  },
  macroInputContainer: {
    flex: 1,
    gap: verticalScale(6),
  },
  macroInput: {
    height: verticalScale(45),
    backgroundColor: colors.neutral800,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    padding: spacingX._15,
    marginBottom: spacingY._15,
    gap: spacingX._12,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacingX._12,
    flex: 1,
  },
  toggleText: {
    flex: 1,
    gap: verticalScale(4),
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.neutral600,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
  },
  toggleCircleActive: {
    alignSelf: "flex-end",
  },
  textAreaInput: {
    height: verticalScale(100),
    alignItems: "flex-start",
    backgroundColor: colors.neutral800,
  },
  textArea: {
    textAlignVertical: "top",
    paddingTop: spacingY._10,
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
  },
  footer: {
    paddingHorizontal: spacingX._20,
    paddingTop: spacingY._15,
    borderTopWidth: 1,
    borderTopColor: colors.neutral700,
  },
});
