import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useNutrition } from "@/src/contexts/nutritionContext";
import { verticalScale } from "@/src/utils/styling";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const NutritionSettings = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { todayNutrition, updateGoals } = useNutrition();

  const [goals, setGoals] = useState({
    calorieGoal: todayNutrition?.calorieGoal || 2500,
    proteinGoal: todayNutrition?.proteinGoal || 150,
    carbsGoal: todayNutrition?.carbsGoal || 250,
    fatGoal: todayNutrition?.fatGoal || 70,
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (goals.calorieGoal <= 0) {
      Alert.alert("Error", "Please enter a valid calorie goal");
      return;
    }

    setSaving(true);
    await updateGoals(goals);
    setSaving(false);

    Alert.alert("Success", "Goals updated successfully!", [
      {
        text: "OK",
        onPress: () => router.back(),
      },
    ]);
  };

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title="Nutrition Settings"
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._20 }}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Typo size={20} fontWeight="600" style={{ marginBottom: spacingY._15 }}>
              Daily Goals
            </Typo>

            {/* Calorie Goal */}
            <View style={styles.inputGroup}>
              <Typo size={16} fontWeight="500" style={{ marginBottom: spacingY._10 }}>
                Calorie Goal
              </Typo>
              <Input
                placeholder="2500"
                keyboardType="numeric"
                value={goals.calorieGoal > 0 ? goals.calorieGoal.toString() : ""}
                onChangeText={(text) =>
                  setGoals({ ...goals, calorieGoal: parseInt(text) || 0 })
                }
                containerStyle={styles.input}
              />
              <Typo size={13} color={colors.neutral400} style={{ marginTop: spacingY._5 }}>
                Recommended: 2000-3000 kcal/day
              </Typo>
            </View>

            {/* Protein Goal */}
            <View style={styles.inputGroup}>
              <Typo size={16} fontWeight="500" style={{ marginBottom: spacingY._10 }}>
                Protein Goal
              </Typo>
              <Input
                placeholder="150"
                keyboardType="numeric"
                value={goals.proteinGoal > 0 ? goals.proteinGoal.toString() : ""}
                onChangeText={(text) =>
                  setGoals({ ...goals, proteinGoal: parseInt(text) || 0 })
                }
                containerStyle={styles.input}
              />
              <Typo size={13} color={colors.neutral400} style={{ marginTop: spacingY._5 }}>
                Recommended: 1.6-2.2g per kg body weight
              </Typo>
            </View>

            {/* Carbs Goal */}
            <View style={styles.inputGroup}>
              <Typo size={16} fontWeight="500" style={{ marginBottom: spacingY._10 }}>
                Carbs Goal
              </Typo>
              <Input
                placeholder="250"
                keyboardType="numeric"
                value={goals.carbsGoal > 0 ? goals.carbsGoal.toString() : ""}
                onChangeText={(text) =>
                  setGoals({ ...goals, carbsGoal: parseInt(text) || 0 })
                }
                containerStyle={styles.input}
              />
              <Typo size={13} color={colors.neutral400} style={{ marginTop: spacingY._5 }}>
                Recommended: 45-65% of total calories
              </Typo>
            </View>

            {/* Fat Goal */}
            <View style={styles.inputGroup}>
              <Typo size={16} fontWeight="500" style={{ marginBottom: spacingY._10 }}>
                Fat Goal
              </Typo>
              <Input
                placeholder="70"
                keyboardType="numeric"
                value={goals.fatGoal > 0 ? goals.fatGoal.toString() : ""}
                onChangeText={(text) =>
                  setGoals({ ...goals, fatGoal: parseInt(text) || 0 })
                }
                containerStyle={styles.input}
              />
              <Typo size={13} color={colors.neutral400} style={{ marginTop: spacingY._5 }}>
                Recommended: 20-35% of total calories
              </Typo>
            </View>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Typo size={15} fontWeight="600" style={{ marginBottom: spacingY._10 }}>
              💡 Quick Tips
            </Typo>
            <Typo size={14} color={colors.neutral400} style={{ lineHeight: 20 }}>
              • Adjust goals based on your fitness objectives{"\n"}
              • For muscle gain: Higher protein & calories{"\n"}
              • For fat loss: Calorie deficit with adequate protein{"\n"}
              • Stay hydrated and consistent
            </Typo>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={[styles.footerSticky, { bottom: insets.bottom + 12 }]}>
          <Button onPress={handleSave} loading={saving} style={{ flex: 1 }}>
            <Typo color={colors.black} fontWeight="700" size={18}>
              Save Goals
            </Typo>
          </Button>
        </View>
      </View>
    </ModalWrapper>
  );
};

export default NutritionSettings;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  scrollContent: {
    paddingBottom: verticalScale(100),
  },
  section: {
    marginBottom: spacingY._25,
  },
  inputGroup: {
    marginBottom: spacingY._20,
  },
  input: {
    backgroundColor: colors.neutral700,
  },
  infoCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  footerSticky: {
    position: "absolute",
    left: spacingX._20,
    right: spacingX._20,
    zIndex: 30,
  },
});