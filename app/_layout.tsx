import { colors } from "@/constants/theme";
import OfflineBanner from "@/src/components/ui/OfflineBanner";
import { AuthProvider } from "@/src/contexts/authContext";
import { NetworkProvider, useNetwork } from "@/src/contexts/networkContext";
import { NutritionProvider } from "@/src/contexts/nutritionContext";
import { WorkoutPlanProvider } from "@/src/contexts/workoutPlanContext";
import { addRecentFood } from "@/src/services/recentFoodsService";
import {
  clearOfflineRecentFoods,
  getOfflineWorkouts,
  processSyncQueue,
  removeOfflineWorkout,
} from "@/src/services/syncQueueService";
import { addWorkout } from "@/src/services/workoutService";
import { Stack } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Alert, StatusBar, View } from "react-native";
import "react-native-reanimated";

if (__DEV__) {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("setLayoutAnimationEnabledExperimental")
    ) {
      return;
    }
    originalWarn(...args);
  };
}

// SYNC MANAGER
const SyncManager = () => {
  const { isConnected } = useNetwork();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isConnected) {
      wasOffline.current = true;
      return;
    }

    if (wasOffline.current && isConnected) {
      wasOffline.current = false;
      handleSync();
    }
  }, [isConnected]);

  const handleSync = async () => {
    console.log(" [SyncManager] Connection restored, syncing...");

    try {
      const offlineWorkouts = await getOfflineWorkouts();
      let syncedWorkouts = 0;

      for (const workout of offlineWorkouts) {
        try {
          const { isOffline, savedAt, ...cleanWorkout } = workout;
          cleanWorkout.id = undefined;

          const result = await addWorkout(cleanWorkout);
          if (result.success && !result.data?.offline) {
            await removeOfflineWorkout(workout.id);
            syncedWorkouts++;
          }
        } catch (error) {
          console.error("[SyncManager] Error syncing workout:", error);
        }
      }

      const queueResult = await processSyncQueue({
        ADD_WORKOUT: async (data) => {
          try {
            const result = await addWorkout(data);
            return result.success && !result.data?.offline;
          } catch {
            return false;
          }
        },
        ADD_RECENT_FOOD: async (data) => {
          try {
            const result = await addRecentFood(
              data.userID,
              data.mealName,
              data.food
            );
            return result.success;
          } catch {
            return false;
          }
        },
      });

      if (queueResult.success > 0) {
        await clearOfflineRecentFoods();
      }

      const total = syncedWorkouts + queueResult.success;
      if (total > 0) {
        console.log(` [SyncManager] Synced ${total} items`);
        Alert.alert(
          "Sync Complete",
          `${total} items have been successfully synced!`
        );
      }
    } catch (error) {
      console.error("[SyncManager] Sync error:", error);
    }
  };

  return null;
};

const StackLayout = () => {
  return (
    <View style={{ flex: 1, backgroundColor: colors.neutral900 }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.neutral900} />
      <OfflineBanner />
      <SyncManager />
      <Stack
        screenOptions={{ 
          headerShown: false, 
          animation: "none",
          contentStyle: {
            backgroundColor: colors.neutral900,
          },
        }}
      >
        {/* Main application routes  */}
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="(auth)" 
          options={{ headerShown: false }} 
        />
        
        {/* Modal screens */}
        <Stack.Screen
          name="(modals)/profileModal"
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="(modals)/addWorkout"
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="(modals)/workoutPlan"
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="(modals)/dayWorkout"
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="(modals)/workoutDetail"
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="(modals)/mealDetail"
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="(modals)/nutritionSettings"
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="(modals)/manualCalories"
          options={{ presentation: "modal", animation: "fade_from_bottom" }}
        />
        <Stack.Screen
          name="(modals)/barcodeScanner"
          options={{
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="(modals)/createFood"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="(modals)/privacyPolicy"
          options={{ presentation: "modal", animation: "slide_from_right" }}
        />
      </Stack>
    </View>
  );
};

export default function RootLayout() {
  return (
    <NetworkProvider>
      <AuthProvider>
        <WorkoutPlanProvider>
          <NutritionProvider>
            <StackLayout />
          </NutritionProvider>
        </WorkoutPlanProvider>
      </AuthProvider>
    </NetworkProvider>
  );
}
