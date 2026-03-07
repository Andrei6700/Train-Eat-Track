import { colors, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import SwipeableScreen from "@/src/components/layout/SwipeableScreen";
import LatestScienceCard from "@/src/components/ui/LatestScienceCard";
import QuickStatsGrid from "@/src/components/ui/QuickStatsGrid";
import RecentWorkouts from "@/src/components/ui/RecentWorkouts";
import Typo from "@/src/components/ui/Typo";
import WeeklyActivityChart from "@/src/components/ui/WeeklyActivityChart";
import { useAuth } from "@/src/contexts/authContext";
import { useLanguage } from "@/src/contexts/languageContext";
import { getHomeDerivedData } from "@/src/features/home/homeSelectors";
import { invalidateCache } from "@/src/services/workoutCacheService";
import { getUserWorkouts } from "@/src/services/workoutService";
import { WorkoutHistory } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

const Home = React.memo(() => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const userId = user?.uid;
  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const latestRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadWorkouts = useCallback(
    async ({ isRefresh = false, shouldInvalidateCache = false } = {}) => {
      if (!userId) return;

      const requestId = ++latestRequestIdRef.current;
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        if (shouldInvalidateCache) {
          invalidateCache();
        }
        const result = await getUserWorkouts(userId);

        if (!isMountedRef.current || requestId !== latestRequestIdRef.current) {
          return;
        }

        if (result.success && Array.isArray(result.data)) {
          setWorkoutsHistory(result.data);
          return;
        }

        setWorkoutsHistory([]);
      } catch {
        if (!isMountedRef.current || requestId !== latestRequestIdRef.current) {
          return;
        }
        setWorkoutsHistory([]);
      } finally {
        if (!isMountedRef.current || requestId !== latestRequestIdRef.current) {
          return;
        }
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) {
      setWorkoutsHistory([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    void loadWorkouts();
  }, [loadWorkouts, userId]);

  const onRefresh = useCallback(() => {
    return loadWorkouts({ isRefresh: true, shouldInvalidateCache: true });
  }, [loadWorkouts]);

  const homeData = useMemo(
    () => getHomeDerivedData(workoutsHistory),
    [workoutsHistory],
  );

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
                  {t("home_welcome_back")}
                </Typo>
                <Typo size={24} fontWeight="700">
                  {user?.name || t("home_user_fallback")}
                </Typo>
              </View>
            </View>

            <QuickStatsGrid stats={homeData.quickStats} loading={loading} />

            <WeeklyActivityChart weekData={homeData.weekData} />

            <RecentWorkouts recentWorkouts={homeData.recentWorkouts} loading={loading} />

            <LatestScienceCard />
          </ScrollView>
        </View>
      </ScreenWrapper>
    </SwipeableScreen>
  );
});

Home.displayName = "Home";

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
