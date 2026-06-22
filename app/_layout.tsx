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
import { BebasNeue_400Regular } from "@expo-google-fonts/bebas-neue";
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import {
    JetBrainsMono_400Regular,
    JetBrainsMono_600SemiBold,
} from "@expo-google-fonts/jetbrains-mono";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useRef } from "react";
import { Alert, Platform, StatusBar, UIManager, View } from "react-native";
import { PerfOverlay } from "@/src/utils/perfMonitor";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";

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

if (Platform.OS === "android") {
  const isNewArch = (global as any).nativeFabricUIManager != null;
  if (!isNewArch && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
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

void SplashScreen.preventAutoHideAsync().catch(() => null);

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

      if (
        !isConnected ||
        summary.retryScheduled === 0 ||
        !summary.nextRetryAt
      ) {
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <OfflineBanner />
        <SyncManager />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "none",
            contentStyle: {
              backgroundColor: colors.background,
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
            name="(modals)/workoutPlanSelection"
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
            name="(modals)/editWorkout"
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
            name="(modals)/manualProductEntry"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="(modals)/createFood"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="(modals)/privacyPolicy"
            options={{ presentation: "modal", animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="(modals)/maintenanceTracker"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
        </Stack>
        {__DEV__ && <PerfOverlay />}
      </View>
    </GestureHandlerRootView>
  );
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_600SemiBold,
  });

  useEffect(() => {
    if (!fontsLoaded) return;
    void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

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
