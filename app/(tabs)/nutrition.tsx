import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import Typo from "@/src/components/ui/Typo";
import WaterWave from "@/src/components/ui/WaterWave";
import { useAuth } from "@/src/contexts/authContext";
import { useNutrition } from "@/src/contexts/nutritionContext";
import { scale, verticalScale } from "@/src/utils/styling";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

const MEALS = ["Mic Dejun", "Pranz", "Cina", "Gustari"];

const Nutrition = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { 
    todayNutrition, 
    todayWater,
    loading, 
    refreshNutrition,
    addWaterIntake,
    resetWaterIntake
  } = useNutrition();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    if (user?.uid) {
      loadNutritionData();
    }
  }, [user?.uid, selectedDate]);

  const loadNutritionData = async () => {
    await refreshNutrition(selectedDate);
    setRefreshing(false);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNutritionData();
  }, [selectedDate]);

  const handleAddWater = async (amount: number) => {
    await addWaterIntake(amount);
  };

  const handleResetWater = () => {
    Alert.alert(
      "Reset Water Intake",
      "Are you sure you want to reset today's water intake?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetWaterIntake();
          },
        },
      ]
    );
  };

  const getTotalCalories = () => {
    if (!todayNutrition) return 0;
    return todayNutrition.meals.reduce((total, meal) => {
      return total + meal.foods.reduce((sum, food) => sum + (food.calories || 0), 0);
    }, 0);
  };

  const getTotalMacros = () => {
    if (!todayNutrition) return { protein: 0, carbs: 0, fat: 0 };
    
    return todayNutrition.meals.reduce((totals, meal) => {
      meal.foods.forEach(food => {
        totals.protein += food.protein || 0;
        totals.carbs += food.carbs || 0;
        totals.fat += food.fat || 0;
      });
      return totals;
    }, { protein: 0, carbs: 0, fat: 0 });
  };

  const getMealData = (mealName: string) => {
    if (!todayNutrition) return null;
    return todayNutrition.meals.find(m => m.mealName === mealName);
  };

  const getMealCalories = (mealName: string) => {
    const meal = getMealData(mealName);
    if (!meal) return 0;
    return meal.foods.reduce((sum, food) => sum + (food.calories || 0), 0);
  };

  const handleMealPress = (mealName: string) => {
    router.push({
      pathname: "/(modals)/mealDetail",
      params: { 
        mealName,
        date: selectedDate.toISOString()
      }
    });
  };

  const totalCalories = getTotalCalories();
  const totalMacros = getTotalMacros();
  const calorieGoal = todayNutrition?.calorieGoal || 2400;
  const proteinGoal = todayNutrition?.proteinGoal || 167;
  const carbsGoal = todayNutrition?.carbsGoal || 483;
  const fatGoal = todayNutrition?.fatGoal || 76;
  const remainingCalories = Math.max(calorieGoal - totalCalories, 0);
  const progress = Math.min((totalCalories / calorieGoal) * 100, 100);

  const waterPercentage = todayWater 
    ? Math.min((todayWater.total / todayWater.goal) * 100, 100)
    : 0;

  // Calcule pentru barele de progres ale macronutrienților
  const proteinProgress = Math.min((totalMacros.protein / proteinGoal) * 100, 100);
  const carbsProgress = Math.min((totalMacros.carbs / carbsGoal) * 100, 100);
  const fatProgress = Math.min((totalMacros.fat / fatGoal) * 100, 100);

  return (
    <ScreenWrapper>
      <ScrollView 
        style={styles.container} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Animated.View 
          entering={FadeIn.duration(400)}
          style={styles.header}
        >
          <Typo size={28} fontWeight="700">
            Nutrition
          </Typo>
          <TouchableOpacity onPress={() => router.push("/(modals)/nutritionSettings")}>
            <Icons.GearSixIcon size={24} color={colors.primary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Objective Card */}
        <Animated.View 
          entering={FadeInDown.duration(400).delay(100)}
          style={styles.objectiveCard}
        >
          {/* Continut principal */}
          <View style={styles.mainContent}>
            {/* Partea stanga */}
            <View style={styles.leftSection}>
              <View style={styles.objectivesContainer}>
                <View style={styles.objectiveItem}>
                  <View style={styles.objectiveHeader}>
                    <Icons.TargetIcon size={20} color={colors.primary} weight="fill" />
                    <Typo size={16} fontWeight="600" color={colors.white}>
                      Obiectiv
                    </Typo>
                  </View>
                  <Typo size={20} fontWeight="700" color={colors.white} style={styles.calorieValue}>
                    {calorieGoal} kcal
                  </Typo>
                </View>
                <View style={styles.objectiveItem}>
                  <View style={styles.objectiveHeader}>
                    <Icons.FireIcon size={20} color="#FF6B35" weight="fill" />
                    <Typo size={16} fontWeight="600" color={colors.white}>
                      Consumat
                    </Typo>
                  </View>
                  <Typo size={20} fontWeight="700" color={colors.white} style={styles.calorieValue}>
                    {totalCalories} kcal
                  </Typo>
                </View>
              </View>
            </View>

            {/* Partea dreaptă - Cerc progres mare cu caloriile rămase */}
            <View style={styles.rightSection}>
              <View style={styles.progressCircleContainer}>
                <View style={styles.progressCircle}>
                  <View style={[styles.progressFill, { height: `${progress}%` }]} />
                  <View style={styles.circleInner}>
                    <Typo size={18} fontWeight="700" color={colors.white} style={styles.remainingCalories}>
                      {remainingCalories}
                    </Typo>
                    <Typo size={12} color={colors.neutral400}>
                      kcal rămase
                    </Typo>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Macronutrienți */}
          <View style={styles.macrosContainer}>
            {/* Proteine */}
            <View style={styles.macroItem}>
              <Typo size={12} color={colors.neutral400} style={styles.macroLabel}>
                Proteine
              </Typo>
              <View style={styles.macroProgressBar}>
                <View 
                  style={[
                    styles.macroProgressFill,
                    { 
                      width: `${proteinProgress}%`,
                      backgroundColor: '#3B33C4'
                    }
                  ]} 
                />
              </View>
              <Typo size={14} fontWeight="600" color={colors.white} style={styles.macroValue}>
                {Math.round(totalMacros.protein)}g / {proteinGoal}g
              </Typo>
            </View>

            {/* Carbohidrați */}
            <View style={styles.macroItem}>
              <Typo size={12} color={colors.neutral400} style={styles.macroLabel}>
                Carbohidrați
              </Typo>
              <View style={styles.macroProgressBar}>
                <View 
                  style={[
                    styles.macroProgressFill,
                    { 
                      width: `${carbsProgress}%`,
                      backgroundColor: '#10B981'
                    }
                  ]} 
                />
              </View>
              <Typo size={14} fontWeight="600" color={colors.white} style={styles.macroValue}>
                {Math.round(totalMacros.carbs)}g / {carbsGoal}g
              </Typo>
            </View>

            {/* Grăsimi */}
            <View style={styles.macroItem}>
              <Typo size={12} color={colors.neutral400} style={styles.macroLabel}>
                Grăsimi
              </Typo>
              <View style={styles.macroProgressBar}>
                <View 
                  style={[
                    styles.macroProgressFill,
                    { 
                      width: `${fatProgress}%`,
                      backgroundColor: '#B413BF'
                    }
                  ]} 
                />
              </View>
              <Typo size={14} fontWeight="600" color={colors.white} style={styles.macroValue}>
                {Math.round(totalMacros.fat)}g / {fatGoal}g
              </Typo>
            </View>
          </View>
        </Animated.View>

        {/* Meals Section */}
        <Animated.View 
          entering={FadeInDown.duration(400).delay(300)}
          style={styles.mealsSection}
        >
          <Typo size={20} fontWeight="600" style={{ marginBottom: spacingY._15 }}>
            Meals
          </Typo>

          {MEALS.map((mealName, index) => {
            const meal = getMealData(mealName);
            const mealCalories = getMealCalories(mealName);
            const hasFoods = meal && meal.foods.length > 0;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.mealCard,
                  hasFoods && styles.mealCardActive
                ]}
                onPress={() => handleMealPress(mealName)}
                activeOpacity={0.7}
              >
                <View style={styles.mealHeader}>
                  <View style={styles.mealInfo}>
                    <Typo size={18} fontWeight="600">
                      {mealName}
                    </Typo>
                    {hasFoods ? (
                      <View style={styles.foodCount}>
                        <Typo size={13} color={colors.neutral400}>
                          {meal.foods.length} food{meal.foods.length !== 1 ? 's' : ''}
                        </Typo>
                      </View>
                    ) : (
                      <Typo size={13} color={colors.neutral400}>
                        No food added
                      </Typo>
                    )}
                  </View>

                  <View style={styles.mealRight}>
                    {hasFoods ? (
                      <View style={styles.caloriesBadge}>
                        <Typo size={16} fontWeight="600" color={colors.white}>
                          {mealCalories}
                        </Typo>
                        <Typo size={11} color={colors.neutral400}>
                          kcal
                        </Typo>
                      </View>
                    ) : (
                      <View style={styles.addIcon}>
                        <Icons.PlusIcon size={20} color={colors.primary} weight="bold" />
                      </View>
                    )}
                  </View>
                </View>

                {hasFoods && (
                  <View style={styles.foodsList}>
                    {meal.foods.slice(0, 3).map((food, idx) => (
                      <View key={idx} style={styles.foodItem}>
                        <View style={styles.foodDot} />
                        <Typo size={14} color={colors.neutral300} numberOfLines={1}>
                          {food.name}
                        </Typo>
                      </View>
                    ))}
                    {meal.foods.length > 3 && (
                      <Typo size={13} color={colors.neutral400} style={{ marginLeft: spacingX._20 }}>
                        +{meal.foods.length - 3} more
                      </Typo>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {/* Water Intake Section */}
        <Animated.View 
          entering={FadeInDown.duration(400).delay(200)}
          style={styles.waterCard}
        >
          <View style={styles.waterHeader}>
            <Icons.DropIcon size={24} color={colors.primary} weight="fill" />
            <Typo size={20} fontWeight="600" style={{ flex: 1 }}>
              Aport apă
            </Typo>
            <TouchableOpacity onPress={handleResetWater}>
              <Icons.ArrowCounterClockwiseIcon size={20} color={colors.neutral400} />
            </TouchableOpacity>
          </View>

          <View style={styles.waterContent}>
            <WaterWave 
              percentage={waterPercentage}
              total={todayWater?.total || 0}
              goal={todayWater?.goal || 2000}
            />
            
            <View style={styles.waterButtons}>
              <TouchableOpacity
                style={styles.waterButton}
                onPress={() => handleAddWater(250)}
              >
                <Typo size={14} fontWeight="600" color={colors.black}>
                  + 250 ml
                </Typo>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.waterButton}
                onPress={() => handleAddWater(500)}
              >
                <Typo size={14} fontWeight="600" color={colors.black}>
                  + 500 ml
                </Typo>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.waterButton}
                onPress={() => handleAddWater(750)}
              >
                <Typo size={14} fontWeight="600" color={colors.black}>
                  + 750 ml
                </Typo>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </ScreenWrapper>
  );
};

export default Nutrition;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacingY._15,
  },
  objectiveCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    marginBottom: spacingY._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  mainContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingY._20,
  },
  leftSection: {
    flex: 1,
  },
  objectivesContainer: {
    gap: spacingY._15,
  },
  objectiveItem: {
    gap: verticalScale(6),
  },
  objectiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingX._8,
  },
  calorieValue: {
    marginLeft: spacingX._28, 
  },
  rightSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleContainer: {
    position: 'relative',
    width: verticalScale(120),
    height: verticalScale(120),
  },
  progressCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    backgroundColor: colors.neutral700,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    backgroundColor: colors.primary,
  },
  circleInner: {
    width: verticalScale(100),
    height: verticalScale(100),
    borderRadius: 50,
    backgroundColor: colors.neutral800,
    justifyContent: 'center',
    alignItems: 'center',
    gap: verticalScale(2),
  },
  remainingCalories: {
    lineHeight: 24,
  },
  macrosContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  macroItem: {
    alignItems: 'center',
    flex: 1,
    gap: verticalScale(6),
  },
  macroLabel: {
    textAlign: 'center',
    marginBottom: verticalScale(4),
  },
  macroProgressBar: {
    width: '80%',
    height: 4,
    backgroundColor: colors.neutral700,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: verticalScale(4),
  },
  macroProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  macroValue: {
    textAlign: 'center',
  },
  waterCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    marginBottom: spacingY._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  waterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    marginBottom: spacingY._20,
  },
  waterContent: {
    alignItems: "center",
    gap: spacingY._20,
  },
  waterButtons: {
    flexDirection: "row",
    gap: spacingX._10,
    width: "100%",
    justifyContent: "center",
  },
  waterButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._20,
    borderRadius: radius._12,
  },
  mealsSection: {
    marginBottom: spacingY._30,
  },
  mealCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    padding: spacingX._20,
    marginBottom: spacingY._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  mealCardActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  mealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mealInfo: {
    flex: 1,
    gap: verticalScale(4),
  },
  foodCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._5,
  },
  mealRight: {
    alignItems: "flex-end",
  },
  caloriesBadge: {
    backgroundColor: colors.neutral700,
    paddingHorizontal: spacingX._15,
    paddingVertical: verticalScale(8),
    borderRadius: radius._12,
    alignItems: "center",
  },
  addIcon: {
    width: verticalScale(40),
    height: verticalScale(40),
    borderRadius: 100,
    backgroundColor: colors.neutral700,
    alignItems: "center",
    justifyContent: "center",
  },
  foodsList: {
    marginTop: spacingY._12,
    gap: verticalScale(6),
  },
  foodItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  foodDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
}); 