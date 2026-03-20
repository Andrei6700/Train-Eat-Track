import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeIn,
} from "react-native-reanimated";
import { PlusCircle, Table } from "phosphor-react-native";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { verticalScale, scale } from "@/src/utils/styling";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import Header from "@/src/components/layout/Header";
import BackButton from "@/src/components/navigation/BackButton";
import Typo from "@/src/components/ui/Typo";
import Loading from "@/src/components/ui/Loading";
import OnboardingCarousel from "@/src/components/maintenance/OnboardingCarousel";
import WeightEntryForm from "@/src/components/maintenance/WeightEntryForm";
import WeeklyTable from "@/src/components/maintenance/WeeklyTable";
import MaintenanceAnalysis from "@/src/components/maintenance/MaintenanceAnalysis";
import { useAuth } from "@/src/contexts/authContext";
import { WeightEntry, WeeklyData, MaintenanceAnalysisResult } from "@/src/types/maintenance";
import {
  hasSeenOnboarding,
  setOnboardingSeen,
  getWeightEntries,
  saveWeightEntry,
  groupEntriesByWeek,
  analyzeMaintenanceStatus,
} from "@/src/services/maintenanceService";

type TabType = "add" | "table";

const TAB_WIDTH = scale(150);

const MaintenanceTrackerScreen = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("add");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [weeks, setWeeks] = useState<WeeklyData[]>([]);
  const [analysis, setAnalysis] = useState<MaintenanceAnalysisResult | null>(null);

  const tabIndicatorPosition = useSharedValue(0);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabIndicatorPosition.value }],
  }));

  const loadData = useCallback(async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);

      // Check onboarding
      const seen = await hasSeenOnboarding();
      if (!seen) {
        setShowOnboarding(true);
      }

      // Load weight entries
      const result = await getWeightEntries(user.uid);
      if (result.success && result.data) {
        setEntries(result.data);

        // Group by week
        const grouped = groupEntriesByWeek(result.data);
        setWeeks(grouped);

        // Analyze if enough data
        const analysisResult = analyzeMaintenanceStatus(grouped, "ro");
        setAnalysis(analysisResult);
      }
    } catch (error) {
      if (__DEV__) {
        console.error("[MaintenanceTracker] Error loading data:", error);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTabChange = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      tabIndicatorPosition.value = withTiming(tab === "add" ? 0 : TAB_WIDTH, {
        duration: 250,
        easing: Easing.out(Easing.ease),
      });
    },
    [tabIndicatorPosition]
  );

  const handleOnboardingDismiss = useCallback(async () => {
    setShowOnboarding(false);
    await setOnboardingSeen();
  }, []);

  const handleSaveEntry = useCallback(
    async (entry: WeightEntry) => {
      if (!user?.uid) return;

      try {
        setSaving(true);
        const result = await saveWeightEntry(user.uid, entry);

        if (result.success) {
          // Reload data
          await loadData();
        }
      } catch (error) {
        if (__DEV__) {
          console.error("[MaintenanceTracker] Error saving entry:", error);
        }
      } finally {
        setSaving(false);
      }
    },
    [user?.uid, loadData]
  );

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title="Tracker Mentenanță"
          leftIcon={<BackButton />}
        />

        {/* Tab Bar */}
        <Animated.View entering={FadeIn.delay(100)} style={styles.tabBar}>
          <View style={styles.tabContainer}>
            <Animated.View style={[styles.tabIndicator, animatedIndicatorStyle]} />
            <Pressable
              style={styles.tab}
              onPress={() => handleTabChange("add")}
            >
              <PlusCircle
                size={verticalScale(18)}
                color={activeTab === "add" ? colors.black : colors.textMuted}
                weight={activeTab === "add" ? "fill" : "regular"}
              />
              <Typo
                size={verticalScale(13)}
                fontWeight={activeTab === "add" ? "700" : "500"}
                color={activeTab === "add" ? colors.black : colors.textMuted}
              >
                Adaugă Greutate
              </Typo>
            </Pressable>
            <Pressable
              style={styles.tab}
              onPress={() => handleTabChange("table")}
            >
              <Table
                size={verticalScale(18)}
                color={activeTab === "table" ? colors.black : colors.textMuted}
                weight={activeTab === "table" ? "fill" : "regular"}
              />
              <Typo
                size={verticalScale(13)}
                fontWeight={activeTab === "table" ? "700" : "500"}
                color={activeTab === "table" ? colors.black : colors.textMuted}
              >
                Tabel Săptămânal
              </Typo>
            </Pressable>
          </View>
        </Animated.View>

        {/* Content */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Loading />
            </View>
          ) : activeTab === "add" ? (
            <Animated.View entering={FadeIn} style={styles.formContainer}>
              <WeightEntryForm onSave={handleSaveEntry} loading={saving} />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn} style={styles.tableContainer}>
              {/* Show analysis if available */}
              {analysis && <MaintenanceAnalysis analysis={analysis} />}

              {/* Weekly table */}
              <WeeklyTable weeks={weeks} />

              {/* Help message if not enough data */}
              {weeks.length > 0 && weeks.length < 2 && (
                <View style={styles.helpMessage}>
                  <Typo
                    size={verticalScale(12)}
                    color={colors.textMuted}
                    style={styles.helpText}
                  >
                    Continuă să înregistrezi greutatea pentru cel puțin 2 săptămâni pentru a vedea analiza mentenanței.
                  </Typo>
                </View>
              )}
            </Animated.View>
          )}
        </View>
      </View>

      {/* Onboarding Modal */}
      <OnboardingCarousel
        visible={showOnboarding}
        onDismiss={handleOnboardingDismiss}
      />
    </ModalWrapper>
  );
};

export default MaintenanceTrackerScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    paddingHorizontal: spacingX._20,
    paddingTop: spacingY._10,
    paddingBottom: spacingY._15,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMid,
    borderRadius: radius._10,
    padding: scale(4),
    position: "relative",
  },
  tabIndicator: {
    position: "absolute",
    top: scale(4),
    left: scale(4),
    width: TAB_WIDTH,
    height: verticalScale(40),
    backgroundColor: colors.primary,
    borderRadius: radius._6,
  },
  tab: {
    width: TAB_WIDTH,
    height: verticalScale(40),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(6),
    zIndex: 1,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  formContainer: {
    flex: 1,
  },
  tableContainer: {
    flex: 1,
  },
  helpMessage: {
    padding: spacingX._20,
    marginTop: spacingY._10,
  },
  helpText: {
    textAlign: "center",
    lineHeight: verticalScale(18),
  },
});
