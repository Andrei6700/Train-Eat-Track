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
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import { getHomeDerivedData } from "@/src/features/home/homeSelectors";
import { prefetchNutritionCalendarSummary } from "@/src/services/nutritionService";
import { invalidateCache } from "@/src/services/workoutCacheService";
import { getCachedWorkoutHistory } from "@/src/services/workoutHistoryCacheService";
import { getUserWorkouts } from "@/src/services/workoutService";
import { WorkoutHistory } from "@/src/types/index";
import { measureAsync } from "@/src/utils/perf";
import { verticalScale } from "@/src/utils/styling";
import { trackScreen, trackDataLoad, trackCacheHit, trackCacheMiss } from "@/src/utils/perfMonitor";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

const Home = React.memo(() => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { workoutPlan } = useWorkoutPlan();
  const userId = user?.uid;
  const [workoutsHistory, setWorkoutsHistory] = useState<WorkoutHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const latestRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const previousUserIdRef = useRef<string | null>(null);

  const mountStartRef = useRef(Date.now());

  useEffect(() => {
    trackScreen("Home", Date.now() - mountStartRef.current);
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadWorkouts = useCallback(
    async ({ isRefresh = false, shouldInvalidateCache = false } = {}) => {
      if (!userId) return;

      const requestId = ++latestRequestIdRef.current;
      let hydratedFromCache = false;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);

        const cachedHistory = await measureAsync(
          "home_hydrate_cache_ms",
          () => getCachedWorkoutHistory(userId, { allowStale: true }),
          (result) => ({
            source: result.data ? "cache" : "fallback",
            itemCount: result.data?.length ?? 0,
            cacheAgeMs: result.ageMs ?? null,
            success: Boolean(result.data),
          }),
        );

        if (!isMountedRef.current || requestId !== latestRequestIdRef.current) {
          return;
        }

        if (cachedHistory.data) {
          trackCacheHit("workouts", cachedHistory.ageMs ?? 0);
          hydratedFromCache = true;
          setWorkoutsHistory(cachedHistory.data);
          setLoading(false);
        } else {
          trackCacheMiss("workouts");
        }
      }

      try {
        if (shouldInvalidateCache) {
          invalidateCache();
        }
        const start = Date.now();
        const result = await measureAsync(
          "home_revalidate_remote_ms",
          () => getUserWorkouts(userId),
          (remoteResult) => ({
            source: remoteResult.success ? "remote" : "fallback",
            itemCount: Array.isArray(remoteResult.data)
              ? remoteResult.data.length
              : 0,
            cacheAgeMs: null,
            success: remoteResult.success,
          }),
        );
        trackDataLoad("workouts", "firebase", Date.now() - start, Array.isArray(result.data) ? result.data.length : 0);

        if (!isMountedRef.current || requestId !== latestRequestIdRef.current) {
          return;
        }

        if (result.success && Array.isArray(result.data)) {
          setWorkoutsHistory(result.data);
          return;
        }

        if (!hydratedFromCache) {
          setWorkoutsHistory([]);
        }
      } catch {
        if (!isMountedRef.current || requestId !== latestRequestIdRef.current) {
          return;
        }
        if (!hydratedFromCache) {
          setWorkoutsHistory([]);
        }
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
    if (userId && previousUserIdRef.current !== userId) {
      setWorkoutsHistory([]);
      setLoading(true);
    }
    previousUserIdRef.current = userId || null;

    if (!userId) {
      setWorkoutsHistory([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    void loadWorkouts();
    void prefetchNutritionCalendarSummary(userId);
  }, [loadWorkouts, userId]);

  const onRefresh = useCallback(() => {
    return loadWorkouts({ isRefresh: true, shouldInvalidateCache: true });
  }, [loadWorkouts]);

  const homeData = useMemo(
    () => getHomeDerivedData(workoutsHistory, workoutPlan),
    [workoutPlan, workoutsHistory],
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
                <Typo size={32} variant="heading">
                  {user?.name || t("home_user_fallback")}
                </Typo>
              </View>
            </View>

            <QuickStatsGrid stats={homeData.quickStats} loading={loading} />

            <WeeklyActivityChart weekData={homeData.weekData} />

            <RecentWorkouts
              recentWorkouts={homeData.recentWorkouts}
              loading={loading}
            />

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
