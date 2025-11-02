import { colors, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/src/contexts/authContext";
import { getUserWorkouts } from "@/src/services/workoutService";
import { WorkoutHistory } from "@/src/types/index";
import { formatDuration } from "@/src/utils/utils";
import { scale, verticalScale } from "@/src/utils/styling";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ImageBackground, StyleSheet, View } from "react-native";
import Typo from "./Typo";

const HistoryCard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalTime: 0,
    daysActive: 0,
    averageDuration: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [user?.uid]);

  const loadStats = async () => {
    if (!user?.uid) return;

    try {
      const result = await getUserWorkouts(user.uid);
      if (result.success && result.data) {
        const workouts: WorkoutHistory[] = result.data;
        
        // Total workouts
        const totalWorkouts = workouts.length;
        
        // Total time 
        const totalTime = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);
        
        // Days active
        const uniqueDays = new Set(
          workouts.map((w) => {
            const date = new Date(w.date);
            return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          })
        );
        const daysActive = uniqueDays.size;
        
        // Average duration
        const averageDuration = totalWorkouts > 0 ? Math.floor(totalTime / totalWorkouts) : 0;

        setStats({
          totalWorkouts,
          totalTime,
          daysActive,
          averageDuration,
        });
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ImageBackground
        source={require("@/assets/images/card.png")}
        resizeMode="stretch"
        style={styles.bgImage}
      >
        <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require("@/assets/images/card.png")}
      resizeMode="stretch"
      style={styles.bgImage}
    >
      <View style={styles.container}>
        <View>
          {/* Header */}
          <View style={styles.totalBalanceRow}>
            <Typo color={colors.neutral800} size={17} fontWeight="700">
              Your Fitness Stats
            </Typo>
          </View>

          {/* Main Stats Row */}
          <View style={styles.mainStatsRow}>
            {/* Total Workouts */}
            <View style={styles.statItem}>
              <Typo color={"#3B33C4"} size={30} fontWeight="bold">
                {stats.totalWorkouts}
              </Typo>
              <Typo
                color={colors.neutral700}
                size={14}
                fontWeight="400"
                style={styles.labelText}
              >
                Total{"\n"}Workouts
              </Typo>
            </View>

            {/* Total Time */}
            <View style={styles.statItem}>
              <Typo color={colors.green} size={30} fontWeight="bold">
                {formatDuration(stats.totalTime)}
              </Typo>
              <Typo
                color={colors.neutral700}
                size={14}
                fontWeight="400"
                style={styles.labelText}
              >
                Total{"\n"}Time
              </Typo>
            </View>

            {/* Days Active */}
            <View style={styles.statItem}>
              <Typo color={"#B413BF"} size={30} fontWeight="bold">
                {stats.daysActive}
              </Typo>
              <Typo
                color={colors.neutral700}
                size={14}
                fontWeight="400"
                style={styles.labelText}
              >
                Days{"\n"}Active
              </Typo>
            </View>
          </View>
        </View>

        {/* Average Workout Duration */}
        <View style={styles.averageSection}>
          <View style={styles.divider} />
          <View style={styles.averageRow}>
            <Typo color={colors.neutral700} size={14} fontWeight="400">
              Average workout duration:
            </Typo>
            <Typo color={colors.black} size={16} fontWeight="600">
              {formatDuration(stats.averageDuration)}
            </Typo>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
};

export default HistoryCard;

const styles = StyleSheet.create({
  bgImage: {
    width: "100%",
    height: verticalScale(210),
  },
  container: {
    padding: spacingX._20,
    paddingHorizontal: scale(23),
    height: "87%",
    width: "100%",
    justifyContent: "space-between",
  },
  totalBalanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._10,
  },
  mainStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  statItem: {
    alignItems: "center",
    gap: verticalScale(5),
  },
  averageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral400,
    width: "100%",
    opacity: 0.3,
  },
  averageSection: {
    gap: verticalScale(12),
  },
  labelText: {
    textAlign: "center",
    lineHeight: 16,
  },
});