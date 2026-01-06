import { colors, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import SwipeableScreen from "@/src/components/layout/SwipeableScreen";
import AICoachCard from "@/src/components/ui/AICoachCard";
import HistoryCard from "@/src/components/ui/HistoryCard";
import LatestScienceCard from "@/src/components/ui/LatestScienceCard";
import TodayGoalsCard from "@/src/components/ui/TodayGoalsCard";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useNutrition } from "@/src/contexts/nutritionContext";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import { getAICoachTip } from "@/src/services/aiCoachService";
import { getUserWorkouts } from "@/src/services/workoutService";
import { WorkoutHistory } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

const DAYS_FULL = [
  "Luni",
  "Marti",
  "Miercuri",
  "Joi",
  "Vineri",
  "Sambata",
  "Duminica",
];

const Home = () => {
  const { user } = useAuth();
  const { workoutPlan } = useWorkoutPlan();
  const { todayNutrition, todayWater } = useNutrition();

  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      loadWorkouts();
    }
  }, [user?.uid]);

  const loadWorkouts = async () => {
    if (!user?.uid) return;

    setLoading(true);
    const result = await getUserWorkouts(user.uid);

    if (result.success && result.data) {
      setWorkoutsHistory(result.data);
    } else {
      setWorkoutsHistory([]);
    }
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWorkouts();
    setRefreshing(false);
  }, [user?.uid]);

  const aiCoachTip = useMemo(() => {
    return getAICoachTip(workoutsHistory);
  }, [workoutsHistory]);

  const getTodayWorkoutName = () => {
    if (!workoutPlan || !workoutPlan.days) return null;

    const today = new Date();
    const dayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const dayName = DAYS_FULL[dayIndex];

    const todayPlan = workoutPlan.days.find((d) => d.day === dayName);
    if (!todayPlan) return null;

    if (todayPlan.isRestDay) {
      return "Rest Day 😴";
    }

    return todayPlan.sessionName || dayName;
  };

  const getCurrentCalories = () => {
    if (!todayNutrition) return 0;
    return todayNutrition.meals.reduce((total, meal) => {
      return (
        total + meal.foods.reduce((mealTotal, food) => mealTotal + food.calories, 0)
      );
    }, 0);
  };

  const getCalorieGoal = () => {
    return todayNutrition?.calorieGoal || 2500;
  };

  const getWaterPercentage = () => {
    if (!todayWater) return 0;
    return Math.min(100, Math.round((todayWater.total / todayWater.goal) * 100));
  };

  return (
    <SwipeableScreen>
      <ScreenWrapper>
        <View style={styles.container}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
          >
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Typo size={16} color={colors.neutral400}>
                  Welcome back,
                </Typo>
                <Typo size={24} fontWeight="700">
                  {user?.name || "User"} 👋
                </Typo>
              </View>
            </View>

            {/* AI Coach Card */}
            <AICoachCard
              tip={aiCoachTip.tip}
              emoji={aiCoachTip.emoji}
              type={aiCoachTip.type}
            />

            {/* Today Goals Card */}
            <TodayGoalsCard
              workoutName={getTodayWorkoutName()}
              currentCalories={getCurrentCalories()}
              calorieGoal={getCalorieGoal()}
              waterPercentage={getWaterPercentage()}
            />

            {/* History Card */}
            <HistoryCard />

            {/* Latest Science Card */}
            <LatestScienceCard />
          </ScrollView>
        </View>
      </ScreenWrapper>
    </SwipeableScreen>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  scrollContent: {
    paddingBottom: verticalScale(100),
    gap: spacingY._20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._10,
  },
});