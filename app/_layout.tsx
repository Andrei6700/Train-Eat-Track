import { colors } from "@/constants/theme";
import OfflineBanner from "@/src/components/ui/OfflineBanner";
import SyncStatusBanner from "@/src/components/ui/SyncStatusBanner";
import { AuthProvider } from "@/src/contexts/authContext";
import { LanguageProvider, useLanguage } from "@/src/contexts/languageContext";
import { NetworkProvider, useNetwork } from "@/src/contexts/networkContext";
import { NutritionProvider } from "@/src/contexts/nutritionContext";
import { WorkoutPlanProvider } from "@/src/contexts/workoutPlanContext";
import { buildSyncHandlers } from "@/src/services/syncEngineService";
import {
  processSyncQueueV2,
  subscribeToSyncQueue,
  SyncQueueSummary,
} from "@/src/services/syncQueueService";
import { Stack } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
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

const EMPTY_SUMMARY: SyncQueueSummary = {
  total: 0,
  pending: 0,
  processing: 0,
  retryScheduled: 0,
  failed: 0,
  conflicts: 0,
  nextRetryAt: null,
};

const SyncManager = () => {
  const { isConnected } = useNetwork();
  const { t } = useLanguage();
  const lastConnectionState = useRef<boolean>(true);
  const isSyncingRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetryTimer = useCallback(() => {
    if (!retryTimerRef.current) return;
    clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
  }, []);

  const runSync = useCallback(
    async (reason: "startup" | "reconnected" | "background" | "manual") => {
      if (!isConnected || isSyncingRef.current) {
        return;
      }

      isSyncingRef.current = true;
      try {
        const result = await processSyncQueueV2(buildSyncHandlers());

        const shouldShowSummary =
          reason !== "background" &&
          result.processed > 0 &&
          (result.success > 0 || result.failed > 0 || result.conflicts > 0);

        if (shouldShowSummary) {
          Alert.alert(
            t("sync_summary_title"),
            t("sync_summary_message", {
              success: result.success,
              failed: result.failed,
              conflicts: result.conflicts,
            }),
          );
        }
      } catch (error) {
        if (__DEV__) {
          console.error("[SyncManager] Sync run failed:", error);
        }
      } finally {
        isSyncingRef.current = false;
      }
    },
    [isConnected, t],
  );

  const scheduleRetrySync = useCallback(
    (summary: SyncQueueSummary) => {
      clearRetryTimer();

      if (!isConnected || summary.retryScheduled === 0 || !summary.nextRetryAt) {
        return;
      }

      const delay = Math.max(0, summary.nextRetryAt - Date.now());
      retryTimerRef.current = setTimeout(() => {
        void runSync("background");
      }, delay + 25);
    },
    [clearRetryTimer, isConnected, runSync],
  );

  useEffect(() => {
    const wasOnline = lastConnectionState.current;
    lastConnectionState.current = isConnected;

    if (!isConnected) {
      clearRetryTimer();
      return;
    }

    if (!wasOnline && isConnected) {
      void runSync("reconnected");
      return;
    }

    void runSync("startup");
  }, [clearRetryTimer, isConnected, runSync]);

  useEffect(() => {
    const unsubscribe = subscribeToSyncQueue((summary) => {
      if (!isConnected) return;

      scheduleRetrySync(summary);

      const shouldRunImmediately =
        summary.pending > 0 ||
        summary.processing > 0 ||
        (summary.retryScheduled > 0 &&
          summary.nextRetryAt !== null &&
          summary.nextRetryAt <= Date.now());

      if (shouldRunImmediately) {
        void runSync("background");
      }
    });

    scheduleRetrySync(EMPTY_SUMMARY);

    return () => {
      unsubscribe();
      clearRetryTimer();
    };
  }, [clearRetryTimer, isConnected, runSync, scheduleRetrySync]);

  return (
    <SyncStatusBanner
      onConflictResolved={async () => {
        if (isConnected) {
          await runSync("manual");
        }
      }}
    />
  );
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />

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
      <LanguageProvider>
        <AuthProvider>
          <WorkoutPlanProvider>
            <NutritionProvider>
              <StackLayout />
            </NutritionProvider>
          </WorkoutPlanProvider>
        </AuthProvider>
      </LanguageProvider>
    </NetworkProvider>
  );
}
