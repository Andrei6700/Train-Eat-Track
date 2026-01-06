import { colors, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
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

const DAYS_FULL = ["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"];

const Home = () => {
  const { user } = useAuth();
  const { workoutPlan } = useWorkoutPlan();
  const { todayNutrition, todayWater } = useNutrition();

  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load workouts history
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

  //  AI Coach Tip 
  const aiCoachTip = useMemo(() => {
    if (workoutsHistory.length === 0) {
      return {
        tip: "Time to start your fitness journey! 🚀",
        emoji: "🚀",
        type: "suggestion" as const,
      };
    }

    return getAICoachTip(workoutsHistory);
  }, [workoutsHistory]);

  //  Today's Workout 
  const todayWorkout = useMemo(() => {
    if (!workoutPlan) return null;

    const today = new Date();
    const dayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const dayName = DAYS_FULL[dayIndex];

    return workoutPlan.days?.find((d) => d.day === dayName) || null;
  }, [workoutPlan]);

  //  Today's Goals 
  const todayGoals = useMemo(() => {
    const workoutGoal = todayWorkout
      ? todayWorkout.isRestDay
        ? "Rest Day"
        : `${todayWorkout.exercises.length} exercises`
      : "No plan";

    const nutritionGoal = todayNutrition
      ? `${todayNutrition.calorieGoal} kcal`
      : "2500 kcal";

    const waterGoal = todayWater ? `${todayWater.goal / 1000}L` : "2L";

    // Check completion
    const workoutCompleted = workoutsHistory.some((w) => {
      const workoutDate = new Date(w.date);
      const today = new Date();
      return workoutDate.toDateString() === today.toDateString();
    });

    const nutritionCompleted = todayNutrition
      ? todayNutrition.meals.reduce((total, meal) => {
          return (
            total +
            meal.foods.reduce((sum, food) => sum + (food.calories || 0), 0)
          );
        }, 0) >= todayNutrition.calorieGoal
      : false;

    const waterCompleted = todayWater ? todayWater.total >= todayWater.goal : false;

    return {
      workout: workoutGoal,
      nutrition: nutritionGoal,
      water: waterGoal,
      workoutCompleted,
      nutritionCompleted,
      waterCompleted,
    };
  }, [todayWorkout, todayNutrition, todayWater, workoutsHistory]);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Typo size={16} color={colors.neutral400}>
              Welcome back,
            </Typo>
            <Typo size={24} fontWeight="700" style={{ marginTop: 4 }}>
              {user?.name}
            </Typo>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollViewStyle}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/*  History Card  */}
          <HistoryCard />

          {/* AI Coach Tip Card  */}
          <AICoachCard
            tip={aiCoachTip.tip}
            emoji={aiCoachTip.emoji}
            type={aiCoachTip.type}
          />

          {/*  Today's Goals Card  */}
          <TodayGoalsCard
            workout={todayGoals.workout}
            nutrition={todayGoals.nutrition}
            water={todayGoals.water}
            workoutCompleted={todayGoals.workoutCompleted}
            nutritionCompleted={todayGoals.nutritionCompleted}
            waterCompleted={todayGoals.waterCompleted}
          />

          {/* Latest Science Card  */}
          <LatestScienceCard />
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  header: {
    paddingTop: spacingY._10,
    paddingBottom: spacingY._15,
  },
  scrollViewStyle: {
    paddingBottom: verticalScale(20), 
  },
});