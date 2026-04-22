import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useLanguage } from "@/src/contexts/languageContext";
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
  const { t } = useLanguage();

  const [goals, setGoals] = useState({
    calorieGoal: todayNutrition?.calorieGoal || 2500,
    proteinGoal: todayNutrition?.proteinGoal || 150,
    carbsGoal: todayNutrition?.carbsGoal || 250,
    fatGoal: todayNutrition?.fatGoal || 70,
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (goals.calorieGoal <= 0) {
      Alert.alert(
        t("common_error"),
        t("nutrition_settings_error_invalid_calorie"),
      );
      return;
    }

    setSaving(true);
    await updateGoals(goals);
    setSaving(false);

    Alert.alert(t("common_success"), t("nutrition_settings_success_goals_updated"), [
      {
        text: t("common_ok"),
        onPress: () => router.back(),
      },
    ]);
  };

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title={t("nutrition_settings_title")}
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._20 }}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Typo size={20} fontWeight="600" style={{ marginBottom: spacingY._15 }}>
              {t("nutrition_settings_daily_goals")}
            </Typo>

            <View style={styles.inputGroup}>
              <Typo size={16} fontWeight="500" style={{ marginBottom: spacingY._10 }}>
                {t("nutrition_settings_calorie_goal")}
              </Typo>
              <Input
                placeholder="2500"
                keyboardType="numeric"
                value={goals.calorieGoal > 0 ? goals.calorieGoal.toString() : ""}
                onChangeText={(text) =>
                  setGoals({ ...goals, calorieGoal: parseInt(text, 10) || 0 })
                }
                containerStyle={styles.input}
              />
              <Typo size={13} color={colors.neutral400} style={{ marginTop: spacingY._5 }}>
                {t("nutrition_settings_recommended_calories")}
              </Typo>
            </View>

            <View style={styles.inputGroup}>
              <Typo size={16} fontWeight="500" style={{ marginBottom: spacingY._10 }}>
                {t("nutrition_settings_protein_goal")}
              </Typo>
              <Input
                placeholder="150"
                keyboardType="numeric"
                value={goals.proteinGoal > 0 ? goals.proteinGoal.toString() : ""}
                onChangeText={(text) =>
                  setGoals({ ...goals, proteinGoal: parseInt(text, 10) || 0 })
                }
                containerStyle={styles.input}
              />
              <Typo size={13} color={colors.neutral400} style={{ marginTop: spacingY._5 }}>
                {t("nutrition_settings_recommended_protein")}
              </Typo>
            </View>

            <View style={styles.inputGroup}>
              <Typo size={16} fontWeight="500" style={{ marginBottom: spacingY._10 }}>
                {t("nutrition_settings_carbs_goal")}
              </Typo>
              <Input
                placeholder="250"
                keyboardType="numeric"
                value={goals.carbsGoal > 0 ? goals.carbsGoal.toString() : ""}
                onChangeText={(text) =>
                  setGoals({ ...goals, carbsGoal: parseInt(text, 10) || 0 })
                }
                containerStyle={styles.input}
              />
              <Typo size={13} color={colors.neutral400} style={{ marginTop: spacingY._5 }}>
                {t("nutrition_settings_recommended_carbs")}
              </Typo>
            </View>

            <View style={styles.inputGroup}>
              <Typo size={16} fontWeight="500" style={{ marginBottom: spacingY._10 }}>
                {t("nutrition_settings_fat_goal")}
              </Typo>
              <Input
                placeholder="70"
                keyboardType="numeric"
                value={goals.fatGoal > 0 ? goals.fatGoal.toString() : ""}
                onChangeText={(text) =>
                  setGoals({ ...goals, fatGoal: parseInt(text, 10) || 0 })
                }
                containerStyle={styles.input}
              />
              <Typo size={13} color={colors.neutral400} style={{ marginTop: spacingY._5 }}>
                {t("nutrition_settings_recommended_fat")}
              </Typo>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Typo size={15} fontWeight="600" style={{ marginBottom: spacingY._10 }}>
              {t("nutrition_settings_quick_tips_title")}
            </Typo>
            <Typo size={14} color={colors.neutral400} style={{ lineHeight: 20 }}>
              {"- "}
              {t("nutrition_settings_tip_adjust_goals")}
              {"\n- "}
              {t("nutrition_settings_tip_muscle_gain")}
              {"\n- "}
              {t("nutrition_settings_tip_fat_loss")}
              {"\n- "}
              {t("nutrition_settings_tip_hydration")}
            </Typo>
          </View>
        </ScrollView>

        <View style={[styles.footerSticky, { bottom: insets.bottom + 12 }]}>
          <Button onPress={handleSave} loading={saving} style={{ flex: 1 }}>
            <Typo color={colors.black} fontWeight="700" size={18}>
              {t("nutrition_settings_save_goals")}
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
    borderWidth: 2,
    borderColor: colors.primary,
  },
  footerSticky: {
    position: "absolute",
    left: spacingX._20,
    right: spacingX._20,
    zIndex: 30,
  },
});

