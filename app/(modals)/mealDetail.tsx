import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useNutrition } from "@/src/contexts/nutritionContext";
import { Food } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MealDetail = () => {
  const { mealName, date } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { todayNutrition, addFoodToMeal, removeFoodFromMeal } = useNutrition();

  const [showAddFood, setShowAddFood] = useState(false);
  const [newFood, setNewFood] = useState<Food>({
    name: "",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    servingSize: "100g",
  });

  const meal = todayNutrition?.meals.find((m) => m.mealName === mealName);

  const getTotalMacros = () => {
    if (!meal) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    return meal.foods.reduce(
      (totals, food) => ({
        calories: totals.calories + (food.calories || 0),
        protein: totals.protein + (food.protein || 0),
        carbs: totals.carbs + (food.carbs || 0),
        fat: totals.fat + (food.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  const handleAddFood = async () => {
    if (!newFood.name.trim()) {
      Alert.alert("Error", "Please enter a food name");
      return;
    }

    if (newFood.calories <= 0) {
      Alert.alert("Error", "Please enter valid calories");
      return;
    }

    await addFoodToMeal(mealName as string, newFood);
    
    setNewFood({
      name: "",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      servingSize: "100g",
    });
    setShowAddFood(false);
  };

  const handleDeleteFood = (index: number) => {
    Alert.alert(
      "Delete Food",
      "Are you sure you want to remove this food?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => removeFoodFromMeal(mealName as string, index),
        },
      ]
    );
  };

  const totals = getTotalMacros();

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title={mealName as string}
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._15 }}
        />

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Typo size={16} fontWeight="600" style={{ marginBottom: spacingY._10 }}>
            Meal Summary
          </Typo>
          
          <View style={styles.macrosGrid}>
            <View style={styles.macroBox}>
              <Typo size={24} fontWeight="700" color={colors.primary}>
                {Math.round(totals.calories)}
              </Typo>
              <Typo size={12} color={colors.neutral400}>
                Calories
              </Typo>
            </View>

            <View style={styles.macroBox}>
              <Typo size={24} fontWeight="700" color={"#3B33C4"}>
                {Math.round(totals.protein)}g
              </Typo>
              <Typo size={12} color={colors.neutral400}>
                Protein
              </Typo>
            </View>

            <View style={styles.macroBox}>
              <Typo size={24} fontWeight="700" color={colors.green}>
                {Math.round(totals.carbs)}g
              </Typo>
              <Typo size={12} color={colors.neutral400}>
                Carbs
              </Typo>
            </View>

            <View style={styles.macroBox}>
              <Typo size={24} fontWeight="700" color={"#B413BF"}>
                {Math.round(totals.fat)}g
              </Typo>
              <Typo size={12} color={colors.neutral400}>
                Fat
              </Typo>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Foods List */}
          {meal && meal.foods.length > 0 ? (
            <View style={styles.foodsSection}>
              <Typo size={18} fontWeight="600" style={{ marginBottom: spacingY._15 }}>
                Foods ({meal.foods.length})
              </Typo>

              {meal.foods.map((food, index) => (
                <View key={index} style={styles.foodCard}>
                  <View style={styles.foodHeader}>
                    <View style={{ flex: 1 }}>
                      <Typo size={16} fontWeight="600">
                        {food.name}
                      </Typo>
                      <Typo size={13} color={colors.neutral400}>
                        {food.servingSize}
                      </Typo>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteFood(index)}
                      style={styles.deleteButton}
                    >
                      <Icons.TrashIcon size={20} color={colors.rose} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.foodMacros}>
                    <View style={styles.foodMacroItem}>
                      <Typo size={14} fontWeight="600">
                        {food.calories}
                      </Typo>
                      <Typo size={11} color={colors.neutral400}>
                        cal
                      </Typo>
                    </View>
                    <View style={styles.foodMacroItem}>
                      <Typo size={14} fontWeight="600">
                        {food.protein}g
                      </Typo>
                      <Typo size={11} color={colors.neutral400}>
                        protein
                      </Typo>
                    </View>
                    <View style={styles.foodMacroItem}>
                      <Typo size={14} fontWeight="600">
                        {food.carbs}g
                      </Typo>
                      <Typo size={11} color={colors.neutral400}>
                        carbs
                      </Typo>
                    </View>
                    <View style={styles.foodMacroItem}>
                      <Typo size={14} fontWeight="600">
                        {food.fat}g
                      </Typo>
                      <Typo size={11} color={colors.neutral400}>
                        fat
                      </Typo>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Icons.ForkKnifeIcon size={48} color={colors.neutral500} weight="fill" />
              <Typo size={18} fontWeight="600" color={colors.neutral200} style={{ marginTop: spacingY._15 }}>
                No food added yet
              </Typo>
              <Typo size={14} color={colors.neutral400} style={{ marginTop: spacingY._7 }}>
                Tap the button below to add food
              </Typo>
            </View>
          )}

          {/* Add Food Form */}
          {showAddFood && (
            <View style={styles.addFoodForm}>
              <Typo size={18} fontWeight="600" style={{ marginBottom: spacingY._15 }}>
                Add Food
              </Typo>

              <Input
                placeholder="Food name"
                value={newFood.name}
                onChangeText={(text) => setNewFood({ ...newFood, name: text })}
                containerStyle={{ marginBottom: spacingY._12 }}
              />

              <View style={styles.inputRow}>
                <Input
                  placeholder="Calories"
                  keyboardType="numeric"
                  value={newFood.calories > 0 ? newFood.calories.toString() : ""}
                  onChangeText={(text) =>
                    setNewFood({ ...newFood, calories: parseFloat(text) || 0 })
                  }
                  containerStyle={styles.smallInput}
                />
                <Input
                  placeholder="Serving"
                  value={newFood.servingSize}
                  onChangeText={(text) =>
                    setNewFood({ ...newFood, servingSize: text })
                  }
                  containerStyle={styles.smallInput}
                />
              </View>

              <View style={styles.inputRow}>
                <Input
                  placeholder="Protein (g)"
                  keyboardType="numeric"
                  value={newFood.protein > 0 ? newFood.protein.toString() : ""}
                  onChangeText={(text) =>
                    setNewFood({ ...newFood, protein: parseFloat(text) || 0 })
                  }
                  containerStyle={styles.macroInput}
                />
                <Input
                  placeholder="Carbs (g)"
                  keyboardType="numeric"
                  value={newFood.carbs > 0 ? newFood.carbs.toString() : ""}
                  onChangeText={(text) =>
                    setNewFood({ ...newFood, carbs: parseFloat(text) || 0 })
                  }
                  containerStyle={styles.macroInput}
                />
                <Input
                  placeholder="Fat (g)"
                  keyboardType="numeric"
                  value={newFood.fat > 0 ? newFood.fat.toString() : ""}
                  onChangeText={(text) =>
                    setNewFood({ ...newFood, fat: parseFloat(text) || 0 })
                  }
                  containerStyle={styles.macroInput}
                />
              </View>

              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowAddFood(false)}
                >
                  <Typo size={16} fontWeight="600" color={colors.neutral400}>
                    Cancel
                  </Typo>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleAddFood}
                >
                  <Typo size={16} fontWeight="600" color={colors.black}>
                    Add Food
                  </Typo>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Add Button */}
        {!showAddFood && (
          <View style={[styles.footerSticky, { bottom: insets.bottom + 12 }]}>
            <Button onPress={() => setShowAddFood(true)} style={{ flex: 1 }}>
              <View style={styles.addButtonContent}>
                <Icons.PlusIcon size={20} color={colors.black} weight="bold" />
                <Typo color={colors.black} fontWeight="700" size={18}>
                  Add Food
                </Typo>
              </View>
            </Button>
          </View>
        )}
      </View>
    </ModalWrapper>
  );
};

export default MealDetail;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  summaryCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    marginBottom: spacingY._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  macrosGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacingX._10,
  },
  macroBox: {
    flex: 1,
    minWidth: "22%",
    backgroundColor: colors.neutral700,
    borderRadius: radius._12,
    padding: spacingX._12,
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: verticalScale(100),
  },
  foodsSection: {
    marginBottom: spacingY._20,
  },
  foodCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    padding: spacingX._15,
    marginBottom: spacingY._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  foodHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacingY._12,
  },
  deleteButton: {
    padding: spacingX._5,
  },
  foodMacros: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: colors.neutral700,
    borderRadius: radius._12,
    padding: spacingX._12,
  },
  foodMacroItem: {
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacingY._50,
  },
  addFoodForm: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    marginBottom: spacingY._20,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  inputRow: {
    flexDirection: "row",
    gap: spacingX._10,
    marginBottom: spacingY._12,
  },
  smallInput: {
    flex: 1,
  },
  macroInput: {
    flex: 1,
  },
  formButtons: {
    flexDirection: "row",
    gap: spacingX._10,
    marginTop: spacingY._10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.neutral700,
    borderRadius: radius._12,
    paddingVertical: spacingY._12,
    alignItems: "center",
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius._12,
    paddingVertical: spacingY._12,
    alignItems: "center",
  },
  footerSticky: {
    position: "absolute",
    left: spacingX._20,
    right: spacingX._20,
    zIndex: 30,
  },
  addButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
  },
});