import { colors, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import Loading from "@/src/components/ui/Loading";
import Typo from "@/src/components/ui/Typo";
import WorkoutCard from "@/src/components/ui/WorkoutCard";
import { useAuth } from "@/src/contexts/authContext";
import { getUserWorkouts } from "@/src/services/workoutService";
import { WorkoutHistory } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";

const History = () => {
  const { user } = useAuth();
  const { workoutPlan } = useWorkoutPlan();
  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { refresh } = useLocalSearchParams();
  const router = useRouter();

  const fetchWorkoutsHistory = async () => {
    if (!user?.uid) return;

    try {
      const result = await getUserWorkouts(user.uid);
      if (result.success) {
        setWorkoutsHistory(result.data || []);
      } else {
        console.error("Error fetching workouts:", result.msg);
      }
    } catch (error) {
      console.error("Error fetching workouts history:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Auto-refresh when coming back from delete
  useFocusEffect(
    useCallback(() => {
      if (refresh === "true") {
        setIsRefreshing(true);
        fetchWorkoutsHistory();
        // Clear the refresh param
        router.setParams({ refresh: undefined });
      }
    }, [refresh])
  );

  useEffect(() => {
    fetchWorkoutsHistory();
  }, [user?.uid]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchWorkoutsHistory();
  };

  const handlePlus = () => {
    if (!workoutPlan) {
      router.push("/(modals)/workoutPlan");
    } else {
      router.push("/(modals)/addWorkout");
    }
  };

  if (isLoading) {
    return (
      <ScreenWrapper>
        <View style={styles.container}>
          <Header title="History" style={{ marginVertical: spacingY._10 }} />
        </View>
        <Loading />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header title="History" style={{ marginVertical: spacingY._10 }} />

        <View style={styles.statsContainer}>
          <Typo size={15} color={colors.neutral400}>
            {workoutsHistory.length} workout
            {workoutsHistory.length !== 1 ? "s" : ""} completed
          </Typo>
        </View>

        <TouchableOpacity
          style={styles.floatingButton}
          onPress={handlePlus}
        >
          <Icons.PlusIcon size={28} color={colors.black} weight="bold" />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {workoutsHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Icons.BarbellIcon
                  size={64}
                  color={colors.neutral500}
                  weight="fill"
                />
              </View>
              <Typo
                size={20}
                fontWeight="600"
                color={colors.neutral200}
                style={{ textAlign: "center", marginTop: spacingY._15 }}
              >
                No workouts logged yet
              </Typo>
              <Typo
                size={15}
                color={colors.neutral400}
                style={{ textAlign: "center", marginTop: spacingY._10 }}
              >
                Start training to see your history here!
              </Typo>
            </View>
          ) : (
            <View style={styles.workoutsList}>
              {workoutsHistory.map((workout) => (
                <WorkoutCard key={workout.id} workout={workout} />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
};

export default History;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  statsContainer: {
    marginBottom: spacingY._15,
  },
  scrollViewContent: {
    paddingBottom: verticalScale(100),
  },
  emptyState: {
    marginTop: verticalScale(80),
    alignItems: "center",
    paddingHorizontal: spacingX._30,
  },
  emptyIconContainer: {
    backgroundColor: colors.neutral800,
    padding: spacingX._25,
    borderRadius: 100,
  },
  workoutsList: {
    gap: spacingY._15,
  },
  floatingButton: {
    position: "absolute",
    right: 24,
    bottom: 110,
    zIndex: 10,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});