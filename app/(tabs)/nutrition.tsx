import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import NutritionCalendar from "@/src/components/ui/NutritionCalendar";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import WaterWave from "@/src/components/ui/WaterWave";
import { useAuth } from "@/src/contexts/authContext";
import { useNutrition } from "@/src/contexts/nutritionContext";
import { preloadWeekNutrition } from "@/src/services/nutritionCacheService";
import { Food } from "@/src/types/index";
import { scale, verticalScale } from "@/src/utils/styling";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

const MEALS = ["Mic Dejun", "Pranz", "Cina", "Gustari"];
const MONTHS = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"
];

const Nutrition = () => {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { 
    todayNutrition, 
    todayWater,
    loading, 
    refreshNutrition,
    addWaterIntake,
    resetWaterIntake,
    removeFoodFromMeal,
    updateFoodQuantity,
    copyFoodToMeal,
    moveFoodToMeal,
  } = useNutrition();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState<Date[]>([]);
  const [daysData, setDaysData] = useState<Array<{date: Date, calories: number, goal: number}>>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFood, setEditingFood] = useState<{
    mealName: string;
    foodIndex: number;
    food: Food;
  } | null>(null);
  const [editQuantity, setEditQuantity] = useState("");

  const [showActionsModal, setShowActionsModal] = useState(false);
  const [actionFood, setActionFood] = useState<{
    mealName: string;
    foodIndex: number;
    food: Food;
  } | null>(null);

  useEffect(() => {
    generateWeek();
  }, []);

  useEffect(() => {
    if (user?.uid) {
      loadNutritionData(selectedDate);
    }
  }, [user?.uid, selectedDate]);

  useEffect(() => {
    if (user?.uid && currentWeek.length > 0) {
      preloadWeekData();
    }
  }, [user?.uid, currentWeek]);

  const generateWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      week.push(day);
    }

    setCurrentWeek(week);
    setSelectedDate(today);
  };

  const preloadWeekData = async () => {
    if (!user?.uid || currentWeek.length === 0) return;

    setCalendarLoading(true);
    const cachedData = await preloadWeekNutrition(user.uid, currentWeek);
    
    const daysArray = currentWeek.map(date => {
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const cached = cachedData.get(key);
      return {
        date,
        calories: cached?.calories || 0,
        goal: cached?.goal || 2500,
      };
    });

    setDaysData(daysArray);
    setCalendarLoading(false);
  };

  const loadNutritionData = async (date: Date) => {
    await refreshNutrition(date);
    setRefreshing(false);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNutritionData(selectedDate);
    preloadWeekData();
  }, [selectedDate, user?.uid]);

  const handleDayPress = useCallback((day: Date, index: number) => {
    setSelectedDate(day);
    // load data in the background
    loadNutritionData(day);
  }, []);

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

  const handleFoodPress = (mealName: string, foodIndex: number, food: Food) => {
    const currentQuantity = parseFloat(food.servingSize) || 100;
    setEditingFood({ mealName, foodIndex, food });
    setEditQuantity(currentQuantity.toString());
    setShowEditModal(true);
  };

  const handleSaveQuantity = async () => {
    if (!editingFood || !editQuantity || parseFloat(editQuantity) <= 0) {
      Alert.alert("Eroare", "Te rog introdu o cantitate validă");
      return;
    }

    await updateFoodQuantity(
      editingFood.mealName,
      editingFood.foodIndex,
      parseFloat(editQuantity)
    );

    setShowEditModal(false);
    setEditingFood(null);
    Alert.alert("Success", "Cantitatea a fost actualizată!");
  };

  const handleFoodLongPress = (mealName: string, foodIndex: number, food: Food) => {
    setActionFood({ mealName, foodIndex, food });
    setShowActionsModal(true);
  };

  const handleCopyFood = (toMeal: string) => {
    if (!actionFood) return;
    
    copyFoodToMeal(actionFood.mealName, actionFood.foodIndex, toMeal);
    setShowActionsModal(false);
    Alert.alert("Success", `${actionFood.food.name} copiat la ${toMeal}`);
  };

  const handleMoveFood = (toMeal: string) => {
    if (!actionFood) return;
    
    moveFoodToMeal(actionFood.mealName, actionFood.foodIndex, toMeal);
    setShowActionsModal(false);
    Alert.alert("Success", `${actionFood.food.name} mutat la ${toMeal}`);
  };

  const handleDeleteFood = () => {
    if (!actionFood) return;

    Alert.alert(
      "Sterge aliment",
      `Esti sigur ca vrei sa stergi ${actionFood.food.name}?`,
      [
        { text: "Anuleaza", style: "cancel" },
        {
          text: "Sterge",
          style: "destructive",
          onPress: async () => {
            await removeFoodFromMeal(actionFood.mealName, actionFood.foodIndex);
            setShowActionsModal(false);
            Alert.alert("Success", "Alimentul a fost șters!");
          },
        },
      ]
    );
  };

  const nutritionStats = useMemo(() => {
    if (!todayNutrition) {
      return {
        totalCalories: 0,
        totalMacros: { protein: 0, carbs: 0, fat: 0 },
        remainingCalories: 2500,
        progress: 0,
        calorieGoal: 2500,
        proteinGoal: 150,
        carbsGoal: 250,
        fatGoal: 70,
        proteinProgress: 0,
        carbsProgress: 0,
        fatProgress: 0,
      };
    }

    const totalCalories = todayNutrition.meals.reduce((total, meal) => {
      return total + meal.foods.reduce((sum, food) => sum + (food.calories || 0), 0);
    }, 0);

    const totalMacros = todayNutrition.meals.reduce((totals, meal) => {
      meal.foods.forEach(food => {
        totals.protein += food.protein || 0;
        totals.carbs += food.carbs || 0;
        totals.fat += food.fat || 0;
      });
      return totals;
    }, { protein: 0, carbs: 0, fat: 0 });

    const calorieGoal = todayNutrition.calorieGoal || 2500;
    const proteinGoal = todayNutrition.proteinGoal || 150;
    const carbsGoal = todayNutrition.carbsGoal || 250;
    const fatGoal = todayNutrition.fatGoal || 70;

    return {
      totalCalories,
      totalMacros,
      remainingCalories: Math.max(calorieGoal - totalCalories, 0),
      progress: Math.min((totalCalories / calorieGoal) * 100, 100),
      calorieGoal,
      proteinGoal,
      carbsGoal,
      fatGoal,
      proteinProgress: Math.min((totalMacros.protein / proteinGoal) * 100, 100),
      carbsProgress: Math.min((totalMacros.carbs / carbsGoal) * 100, 100),
      fatProgress: Math.min((totalMacros.fat / fatGoal) * 100, 100),
    };
  }, [todayNutrition]);

  const waterPercentage = useMemo(() => {
    return todayWater 
      ? Math.min((todayWater.total / todayWater.goal) * 100, 100)
      : 0;
  }, [todayWater]);

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const isYesterday = (() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return selectedDate.toDateString() === yesterday.toDateString();
  })();

  const formatDateHeader = () => {
    if (isToday) return "Azi";
    if (isYesterday) return "Ieri";
    
    const day = selectedDate.getDate();
    const month = MONTHS[selectedDate.getMonth()];
    const year = selectedDate.getFullYear();
    
    return `${day} ${month}, ${year}`;
  };

  const getMealData = useCallback((mealName: string) => {
    if (!todayNutrition) return null;
    return todayNutrition.meals.find(m => m.mealName === mealName);
  }, [todayNutrition]);

  const getMealCalories = useCallback((mealName: string) => {
    const meal = getMealData(mealName);
    if (!meal) return 0;
    return meal.foods.reduce((sum, food) => sum + (food.calories || 0), 0);
  }, [getMealData]);

  const getMealMacros = useCallback((mealName: string) => {
    const meal = getMealData(mealName);
    if (!meal) return { protein: 0, carbs: 0, fat: 0 };
    
    return meal.foods.reduce((totals, food) => {
      totals.protein += food.protein || 0;
      totals.carbs += food.carbs || 0;
      totals.fat += food.fat || 0;
      return totals;
    }, { protein: 0, carbs: 0, fat: 0 });
  }, [getMealData]);

  const getMealMacroPercentages = useCallback((mealName: string) => {
    const mealMacros = getMealMacros(mealName);
    const totalGrams = mealMacros.protein + mealMacros.carbs + mealMacros.fat;
    
    if (totalGrams === 0) {
      return { protein: 0, carbs: 0, fat: 0 };
    }

    return {
      protein: Math.round((mealMacros.protein / totalGrams) * 100),
      carbs: Math.round((mealMacros.carbs / totalGrams) * 100),
      fat: Math.round((mealMacros.fat / totalGrams) * 100)
    };
  }, [getMealMacros]);

  const handleMealPress = (mealName: string) => {
    router.push({
      pathname: "/(modals)/mealDetail",
      params: { 
        mealName,
        date: selectedDate.toISOString()
      }
    });
  };

  const getFoodIcon = (foodName: string, brand?: string) => {
    const name = foodName.toLowerCase();
    const brandName = brand?.toLowerCase() || '';

    if (name.includes('protein') || name.includes('Proteine') || name.includes('powerjack') || name.includes('whey')) {
      return <Icons.Package size={20} color={colors.primary} weight="fill" />;
    }
    
    if (name.includes('unt') || name.includes('butter') || name.includes('peanut') || name.includes('arahide')) {
      return <Icons.Package size={20} color={colors.primary} weight="fill" />;
    }
    
    if (name.includes('fulgi') || name.includes('flakes') || name.includes('corn') || name.includes('cereale')) {
      return <Icons.Package size={20} color={colors.primary} weight="fill" />;
    }
    
    if (name.includes('lapte') || name.includes('milk') || brandName.includes('pilos')) {
      return <Icons.Package size={20} color={colors.primary} weight="fill" />;
    }
    
    if (name.includes('pui') || name.includes('piept') || name.includes('carne') || name.includes('chicken') || name.includes('beef') || name.includes('pork')) {
      return <Icons.Package size={20} color={colors.primary} weight="fill" />;
    }
    
    if (name.includes('somon') || name.includes('peste') || name.includes('fish') || name.includes('ton')) {
      return <Icons.Package size={20} color={colors.primary} weight="fill" />;
    }
    
    if (name.includes('ou') || name.includes('egg') || name.includes('oua')) {
      return <Icons.Package size={20} color={colors.primary} weight="fill" />;
    }
    
    if (name.includes('paine') || name.includes('bread') || name.includes('paine')) {
      return <Icons.Package size={20} color={colors.primary} weight="fill" />;
    }
    
    if (name.includes('fruct') || name.includes('fruit') || name.includes('banana') || name.includes('apple') || name.includes('mar')) {
      return <Icons.Package size={20} color={colors.primary} weight="fill" />;
    }
    
    return <Icons.Package size={20} color={colors.primary} weight="fill" />;
  };

  const proteinColor = '#10B981';
  const carbsColor = '#EF4444';
  const fatColor = '#F59E0B';

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
        {/*  Date Header  */}
        <Animated.View 
          entering={FadeInDown.duration(400)}
          style={styles.dateHeader}
        >
          <View style={styles.dateHeaderContent}>
            <Typo size={24} fontWeight="700">
              {formatDateHeader()}
            </Typo>
            <TouchableOpacity onPress={() => router.push("/(modals)/nutritionSettings")}>
              <Icons.Gear size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Calendar Component */}
        <NutritionCalendar
          currentWeek={currentWeek}
          selectedDate={selectedDate}
          daysData={daysData}
          loading={calendarLoading}
          onDayPress={handleDayPress}
        />

        {/* Objective Card */}
        <Animated.View 
          entering={FadeInDown.duration(400).delay(100)}
          style={styles.objectiveCard}
        >
          <View style={styles.mainContent}>
            <View style={styles.leftSection}>
              <View style={styles.objectivesContainer}>
                <View style={styles.objectiveItem}>
                  <View style={styles.objectiveHeader}>
                    <Icons.Target size={20} color={colors.primary} weight="fill" />
                    <Typo size={16} fontWeight="600" color={colors.white}>
                      Obiectiv
                    </Typo>
                  </View>
                  <Typo size={20} fontWeight="700" color={colors.white} style={styles.calorieValue}>
                    {nutritionStats.calorieGoal} kcal
                  </Typo>
                </View>
                <View style={styles.objectiveItem}>
                  <View style={styles.objectiveHeader}>
                    <Icons.Fire size={20} color="#FF6B35" weight="fill" />
                    <Typo size={16} fontWeight="600" color={colors.white}>
                      Consumat
                    </Typo>
                  </View>
                  <Typo size={20} fontWeight="700" color={colors.white} style={styles.calorieValue}>
                    {nutritionStats.totalCalories} kcal
                  </Typo>
                </View>
              </View>
            </View>

            <View style={styles.rightSection}>
              <View style={styles.progressCircleContainer}>
                <View style={styles.progressCircle}>
                  <View style={[styles.progressFill, { height: `${nutritionStats.progress}%` }]} />
                  <View style={styles.circleInner}>
                    <Typo size={18} fontWeight="700" color={colors.white} style={styles.remainingCalories}>
                      {nutritionStats.remainingCalories}
                    </Typo>
                    <Typo size={12} color={colors.neutral400}>
                      kcal rămase
                    </Typo>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.macrosContainer}>
            <View style={styles.macroItem}>
              <Typo size={12} color={colors.neutral400} style={styles.macroLabel}>
                Proteine
              </Typo>
              <View style={styles.macroProgressBar}>
                <View 
                  style={[
                    styles.macroProgressFill,
                    { 
                      width: `${nutritionStats.proteinProgress}%`,
                      backgroundColor: proteinColor
                    }
                  ]} 
                />
              </View>
              <Typo size={14} fontWeight="600" color={colors.white} style={styles.macroValue}>
                {Math.round(nutritionStats.totalMacros.protein)}g / {nutritionStats.proteinGoal}g
              </Typo>
            </View>

            <View style={styles.macroItem}>
              <Typo size={12} color={colors.neutral400} style={styles.macroLabel}>
                Carbohidrati
              </Typo>
              <View style={styles.macroProgressBar}>
                <View 
                  style={[
                    styles.macroProgressFill,
                    { 
                      width: `${nutritionStats.carbsProgress}%`,
                      backgroundColor: carbsColor
                    }
                  ]} 
                />
              </View>
              <Typo size={14} fontWeight="600" color={colors.white} style={styles.macroValue}>
                {Math.round(nutritionStats.totalMacros.carbs)}g / {nutritionStats.carbsGoal}g
              </Typo>
            </View>

            <View style={styles.macroItem}>
              <Typo size={12} color={colors.neutral400} style={styles.macroLabel}>
                Grasimi
              </Typo>
              <View style={styles.macroProgressBar}>
                <View 
                  style={[
                    styles.macroProgressFill,
                    { 
                      width: `${nutritionStats.fatProgress}%`,
                      backgroundColor: fatColor
                    }
                  ]} 
                />
              </View>
              <Typo size={14} fontWeight="600" color={colors.white} style={styles.macroValue}>
                {Math.round(nutritionStats.totalMacros.fat)}g / {nutritionStats.fatGoal}g
              </Typo>
            </View>
          </View>
        </Animated.View>

        {/* Meals Section */}
        <Animated.View 
          entering={FadeInDown.duration(400).delay(300)}
          style={styles.mealsSection}
        >
          {MEALS.map((mealName, index) => {
            const meal = getMealData(mealName);
            const mealCalories = getMealCalories(mealName);
            const mealMacros = getMealMacros(mealName);
            const mealPercentages = getMealMacroPercentages(mealName);
            const hasFoods = meal && meal.foods.length > 0;

            const circumference = 2 * Math.PI * 40;
            const proteinArc = (mealPercentages.protein / 100) * circumference;
            const carbsArc = (mealPercentages.carbs / 100) * circumference;
            const fatArc = (mealPercentages.fat / 100) * circumference;

            return (
              <View
                key={index}
                style={styles.mealCardExact}
              >
                <View style={styles.mealHeaderExact}>
                  <Typo size={18} fontWeight="700" color={colors.white}>
                    {mealName}
                  </Typo>
                </View>

                <View style={styles.nutritionRow}>
                  <View style={styles.circleContainerRow}>
                    <Svg width={80} height={80} viewBox="0 0 100 100">
                      <Circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke={colors.neutral700}
                        strokeWidth="8"
                        fill="none"
                      />
                      <Circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke={proteinColor}
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${proteinArc} ${circumference}`}
                        strokeDashoffset="0"
                        transform="rotate(-90 50 50)"
                      />
                      <Circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke={carbsColor}
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${carbsArc} ${circumference}`}
                        strokeDashoffset={-proteinArc}
                        transform="rotate(-90 50 50)"
                      />
                      <Circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke={fatColor}
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${fatArc} ${circumference}`}
                        strokeDashoffset={-(proteinArc + carbsArc)}
                        transform="rotate(-90 50 50)"
                      />
                    </Svg>
                    
                    <View style={styles.circleTextRow}>
                      <Typo size={16} fontWeight="600" color={colors.white} style={styles.calorieValueText}>
                        {mealCalories.toFixed(0)}
                      </Typo>
                      <Typo size={10} color={colors.neutral400} style={styles.calorieLabelText}>
                        kCal
                      </Typo>
                    </View>
                  </View>

                  <View style={styles.macrosContainerRow}>
                    <View style={styles.macroItemRow}>
                      <Typo size={12} fontWeight="600" color={colors.white} style={styles.macroPercentage}>
                        {mealPercentages.protein}%
                      </Typo>
                      <Typo size={14} fontWeight="700" color={colors.white} style={styles.macroValueRow}>
                        {Math.round(mealMacros.protein)} g
                      </Typo>
                      <Typo size={10} color={colors.neutral400} style={styles.macroLabelRow}>
                        Prot.
                      </Typo>
                    </View>

                    <View style={styles.macroItemRow}>
                      <Typo size={12} fontWeight="600" color={colors.white} style={styles.macroPercentage}>
                        {mealPercentages.carbs}%
                      </Typo>
                      <Typo size={14} fontWeight="700" color={colors.white} style={styles.macroValueRow}>
                        {Math.round(mealMacros.carbs)} g
                      </Typo>
                      <Typo size={10} color={colors.neutral400} style={styles.macroLabelRow}>
                        Carb.
                      </Typo>
                    </View>

                    <View style={styles.macroItemRow}>
                      <Typo size={12} fontWeight="600" color={colors.white} style={styles.macroPercentage}>
                        {mealPercentages.fat}%
                      </Typo>
                      <Typo size={14} fontWeight="700" color={colors.white} style={styles.macroValueRow}>
                        {Math.round(mealMacros.fat)} g
                      </Typo>
                      <Typo size={10} color={colors.neutral400} style={styles.macroLabelRow}>
                        Grasimi
                      </Typo>
                    </View>
                  </View>
                </View>

                {hasFoods && (
                  <View style={styles.foodsList}>
                    {meal.foods.map((food, foodIndex) => (
                      <TouchableOpacity
                        key={foodIndex}
                        style={styles.foodItemImage}
                        onPress={() => handleFoodPress(mealName, foodIndex, food)}
                        onLongPress={() => handleFoodLongPress(mealName, foodIndex, food)}
                      >
                        <View style={styles.foodMainRow}>
                          <View style={styles.foodIconBox}>
                            {getFoodIcon(food.name, (food as any).brand)}
                          </View>
                          
                          <View style={styles.foodContentColumn}>
                            <Typo size={14} fontWeight="600" color={colors.white} numberOfLines={1}>
                              {food.name}
                            </Typo>
                            {(food as any).brand && (
                              <Typo size={11} color={colors.neutral400} numberOfLines={1}>
                                {(food as any).brand}
                              </Typo>
                            )}
                            
                            <View style={styles.foodMetricsRow}>
                              <View style={styles.metricItem}>
                                <Icons.Scales size={12} color={colors.neutral400} weight="fill" />
                                <Typo size={11} color={colors.white}>
                                  {food.servingSize || '100'} Grame
                                </Typo>
                              </View>
                              
                              <View style={styles.metricItem}>
                                <Icons.Flame size={12} color={colors.neutral400} weight="fill" />
                                <Typo size={11} color={colors.white}>
                                  {Math.round(food.calories)}kCal
                                </Typo>
                              </View>
                            </View>
                            
                            <View style={styles.macrosRow}>
                              <View style={styles.macroTag}>
                                <Icons.Drop size={12} color={proteinColor} weight="fill" />
                                <Typo size={11} color={colors.white}>
                                  {Math.round(food.protein)}g
                                </Typo>
                              </View>
                              
                              <View style={styles.macroTag}>
                                <Icons.GrainsSlash size={12} color={carbsColor} weight="fill" />
                                <Typo size={11} color={colors.white}>
                                  {Math.round(food.carbs)}g
                                </Typo>
                              </View>
                              
                              <View style={styles.macroTag}>
                                <Icons.Nut size={12} color={fatColor} weight="fill" />
                                <Typo size={11} color={colors.white}>
                                  {Math.round(food.fat)}g
                                </Typo>
                              </View>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <TouchableOpacity 
                  style={styles.addButtonExact}
                  onPress={() => handleMealPress(mealName)}
                >
                  <Icons.Plus size={18} color={colors.primary} weight="bold" />
                  <Typo size={15} fontWeight="600" color={colors.primary}>
                    Adauga alimente
                  </Typo>
                </TouchableOpacity>
              </View>
            );
          })}
        </Animated.View>

        {/* Water Intake Section */}
        <Animated.View 
          entering={FadeInDown.duration(400).delay(200)}
          style={styles.waterCard}
        >
          <View style={styles.waterHeader}>
            <Icons.Drop size={24} color={colors.primary} weight="fill" />
            <Typo size={20} fontWeight="600" style={{ flex: 1 }}>
              Aport apă
            </Typo>
            <TouchableOpacity onPress={handleResetWater}>
              <Icons.ArrowCounterClockwise size={20} color={colors.neutral400} />
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

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowEditModal(false)}
          />
          
          <View style={[styles.editModal, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.handleBar} />

            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Icons.X size={24} color={colors.white} weight="bold" />
              </TouchableOpacity>
              <Typo size={20} fontWeight="700">
                Editeaza cantitatea
              </Typo>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {editingFood && (
                <View style={styles.modalContent}>
                  <View style={styles.foodInfoModal}>
                    <Typo size={18} fontWeight="700" style={{ textAlign: 'center' }}>
                      {editingFood.food.name}
                    </Typo>
                    <Typo size={14} color={colors.neutral400} style={{ textAlign: 'center', marginTop: spacingY._5 }}>
                      {editingFood.mealName}
                    </Typo>
                  </View>

                  <View style={styles.quantitySection}>
                    <Typo size={16} fontWeight="600" style={{ marginBottom: spacingY._12 }}>
                      Cantitate (grame)
                    </Typo>
                    <Input
                      placeholder="100"
                      value={editQuantity}
                      onChangeText={setEditQuantity}
                      keyboardType="numeric"
                      containerStyle={styles.quantityInput}
                    />
                  </View>

                  <View style={styles.adjustedNutrition}>
                    <Typo size={15} fontWeight="600" style={{ marginBottom: spacingY._12 }}>
                      Valori calculate pentru {editQuantity || '0'}g:
                    </Typo>
                    
                    <View style={styles.nutritionGrid}>
                      <View style={styles.nutritionItem}>
                        <Typo size={24} fontWeight="700" color={colors.primary}>
                          {Math.round(editingFood.food.calories * (parseFloat(editQuantity) || 0) / 100)}
                        </Typo>
                        <Typo size={12} color={colors.neutral400}>kcal</Typo>
                      </View>

                      <View style={styles.nutritionItem}>
                        <Typo size={20} fontWeight="600">
                          {Math.round(editingFood.food.protein * (parseFloat(editQuantity) || 0) / 100 * 10) / 10}g
                        </Typo>
                        <Typo size={12} color={colors.neutral400}>Proteine</Typo>
                      </View>

                      <View style={styles.nutritionItem}>
                        <Typo size={20} fontWeight="600">
                          {Math.round(editingFood.food.carbs * (parseFloat(editQuantity) || 0) / 100 * 10) / 10}g
                        </Typo>
                        <Typo size={12} color={colors.neutral400}>Carbohidrati</Typo>
                      </View>

                      <View style={styles.nutritionItem}>
                        <Typo size={20} fontWeight="600">
                          {Math.round(editingFood.food.fat * (parseFloat(editQuantity) || 0) / 100 * 10) / 10}g
                        </Typo>
                        <Typo size={12} color={colors.neutral400}>Grasimi</Typo>
                      </View>
                    </View>
                  </View>

                  <Button 
                    onPress={handleSaveQuantity}
                    style={{ marginTop: spacingY._20 }}
                  >
                    <Typo size={18} fontWeight="700" color={colors.black}>
                      Salveaza
                    </Typo>
                  </Button>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Actions Modal */}
      <Modal
        visible={showActionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionsModal(false)}
      >
        <TouchableOpacity 
          style={styles.actionsOverlay}
          activeOpacity={1}
          onPress={() => setShowActionsModal(false)}
        >
          <View style={[styles.actionsModal, { bottom: insets.bottom + 20 }]}>
            {actionFood && (
              <>
                <View style={styles.actionsHeader}>
                  <Typo size={18} fontWeight="700">
                    {actionFood.food.name}
                  </Typo>
                </View>

                <View style={styles.actionsList}>
                  <View style={styles.actionGroup}>
                    <Typo size={15} fontWeight="600" color={colors.neutral400} style={{ marginBottom: spacingY._10 }}>
                      Copiaza la:
                    </Typo>
                    {MEALS.filter(m => m !== actionFood.mealName).map((meal, idx) => (
                      <TouchableOpacity
                        key={`copy-${idx}`}
                        style={styles.actionButton}
                        onPress={() => handleCopyFood(meal)}
                      >
                        <Icons.Copy size={20} color={colors.primary} weight="bold" />
                        <Typo size={16} fontWeight="500">
                          {meal}
                        </Typo>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.actionGroup}>
                    <Typo size={15} fontWeight="600" color={colors.neutral400} style={{ marginBottom: spacingY._10 }}>
                      Muta la:
                    </Typo>
                    {MEALS.filter(m => m !== actionFood.mealName).map((meal, idx) => (
                      <TouchableOpacity
                        key={`move-${idx}`}
                        style={styles.actionButton}
                        onPress={() => handleMoveFood(meal)}
                      >
                        <Icons.ArrowsDownUp size={20} color={colors.green} weight="bold" />
                        <Typo size={16} fontWeight="500">
                          {meal}
                        </Typo>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteAction]}
                    onPress={handleDeleteFood}
                  >
                    <Icons.Trash size={20} color={colors.rose} weight="bold" />
                    <Typo size={16} fontWeight="600" color={colors.rose}>
                      Sterge aliment
                    </Typo>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </ScreenWrapper>
  );
};


export default Nutrition;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  dateHeader: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    marginVertical: spacingY._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  dateHeaderContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    gap: spacingY._15,
  },
  mealCardExact: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
    marginBottom: spacingY._15,
  },
  mealHeaderExact: {
    marginBottom: 16,
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral900,
    borderRadius: radius._12,
    padding: 16,
    marginBottom: 16,
  },
  circleContainerRow: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  circleTextRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calorieValueText: {
    lineHeight: 18,
    marginBottom: 1,
  },
  calorieLabelText: {
    lineHeight: 12,
  },
  macrosContainerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
    marginLeft: 16,
  },
  macroItemRow: {
    alignItems: 'center',
    flex: 1,
  },
  macroPercentage: {
    marginBottom: 2,
  },
  macroValueRow: {
    marginBottom: 1,
  },
  macroLabelRow: {
    lineHeight: 12,
  },
  foodsList: {
    gap: 8,
    marginBottom: 16,
  },
  foodItemImage: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    borderWidth: 0,
  },
  foodMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  foodIconBox: {
    width: 32,
    height: 32,
    backgroundColor: colors.neutral900,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  foodContentColumn: {
    flex: 1,
    gap: 4,
  },
  foodMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  macroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  addButtonExact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  editModal: {
    backgroundColor: colors.neutral900,
    borderTopLeftRadius: radius._20,
    borderTopRightRadius: radius._20,
    maxHeight: '85%',
    paddingTop: spacingY._15,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.neutral600,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacingY._15,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingX._20,
    marginBottom: spacingY._20,
  },
  modalContent: {
    paddingHorizontal: spacingX._20,
  },
  foodInfoModal: {
    alignItems: 'center',
    marginBottom: spacingY._25,
  },
  quantitySection: {
    marginBottom: spacingY._25,
  },
  quantityInput: {
    backgroundColor: colors.neutral800,
  },
  adjustedNutrition: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingX._15,
    justifyContent: 'space-between',
  },
  nutritionItem: {
    alignItems: 'center',
    width: '45%',
    backgroundColor: colors.neutral900,
    padding: spacingX._15,
    borderRadius: radius._12,
  },
  actionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionsModal: {
    position: 'absolute',
    left: spacingX._20,
    right: spacingX._20,
    backgroundColor: colors.neutral900,
    borderRadius: radius._17,
    padding: spacingX._20,
    maxHeight: '70%',
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
  actionGroup: {
    gap: spacingY._10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
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