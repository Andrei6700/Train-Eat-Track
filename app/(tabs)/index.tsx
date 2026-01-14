import { colors, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import SwipeableScreen from "@/src/components/layout/SwipeableScreen";
import LatestScienceCard from "@/src/components/ui/LatestScienceCard";
import QuickStatsGrid from "@/src/components/ui/QuickStatsGrid";
import RecentWorkouts from "@/src/components/ui/RecentWorkouts";
import Typo from "@/src/components/ui/Typo";
import WeeklyActivityChart from "@/src/components/ui/WeeklyActivityChart";
import { useAuth } from "@/src/contexts/authContext";
import { invalidateCache } from "@/src/services/workoutCacheService";
import { getUserWorkouts } from "@/src/services/workoutService";
import { WorkoutHistory } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

const Home = React.memo(() => {
  const { user } = useAuth();
  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      loadWorkouts();
    }
  }, [user?.uid]);

  const loadWorkouts = useCallback(async () => {
    if (!user?.uid) return;

    setLoading(true);
    const result = await getUserWorkouts(user.uid);

    if (result.success && result.data) {
      setWorkoutsHistory(result.data);
    } else {
      setWorkoutsHistory([]);
    }
    setLoading(false);
  }, [user?.uid]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    invalidateCache();
    await loadWorkouts();
    setRefreshing(false);
  }, [loadWorkouts]);

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
            <View style={styles.header}>
              <View>
                <Typo size={16} color={colors.neutral400}>
                  Welcome back,
                </Typo>
                <Typo size={24} fontWeight="700">
                  {user?.name || "User"}
                </Typo>
              </View>
            </View>

            <QuickStatsGrid workouts={workoutsHistory} loading={loading} />

            <WeeklyActivityChart workouts={workoutsHistory} />

            <RecentWorkouts workouts={workoutsHistory} loading={loading} />

            <LatestScienceCard />
          </ScrollView>
        </View>
      </ScreenWrapper>
    </SwipeableScreen>
  );
});

Home.displayName = 'Home';

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