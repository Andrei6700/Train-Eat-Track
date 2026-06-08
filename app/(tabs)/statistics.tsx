import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import SwipeableScreen from "@/src/components/layout/SwipeableScreen";
import WorkoutStatistics from "@/src/components/statistics/WorkoutStatistics";
import NutritionStatistics from "@/src/components/statistics/NutritionStatistics";
import Typo from "@/src/components/ui/Typo";
import { useLanguage } from "@/src/contexts/languageContext";
import { verticalScale } from "@/src/utils/styling";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import React, { useState, useCallback, useTransition, useRef, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

type PeriodType = "Weekly" | "Monthly" | "Yearly";
type StatisticsTab = "workouts" | "nutrition";

const Statistics = React.memo(() => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<StatisticsTab>("workouts");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("Monthly");
  const [dataPeriod, setDataPeriod] = useState<PeriodType>("Monthly");
  const [, startTransition] = useTransition();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePeriodChange = useCallback((period: PeriodType) => {
    setSelectedPeriod(period);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      startTransition(() => {
        setDataPeriod(period);
      });
    }, 150);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleTabChange = useCallback((index: number) => {
    setActiveTab(index === 0 ? "workouts" : "nutrition");
  }, []);

  return (
    <SwipeableScreen>
      <ScreenWrapper>
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Typo size={32} variant="heading" style={styles.headerText}>
              {t("tab_statistics")}
            </Typo>
          </View>

          {/* Tab toggle: Workouts / Nutrition */}
          <View style={styles.tabToggleContainer}>
            <View style={styles.stackedOuter}>
              <View style={styles.shadowRounded17} />
              <View style={styles.tabToggleCard}>
                <SegmentedControl
                  values={[
                    t("statistics_tab_workouts"),
                    t("statistics_tab_nutrition"),
                  ]}
                  selectedIndex={activeTab === "workouts" ? 0 : 1}
                  onChange={(event) =>
                    handleTabChange(event.nativeEvent.selectedSegmentIndex)
                  }
                  style={styles.segmentedControl}
                  backgroundColor={colors.neutral800}
                  tintColor={colors.primary}
                  fontStyle={{
                    color: colors.neutral400,
                    fontSize: verticalScale(14),
                    fontWeight: "600",
                  }}
                  activeFontStyle={{
                    color: colors.black,
                    fontSize: verticalScale(14),
                    fontWeight: "700",
                  }}
                />
              </View>
            </View>
          </View>

          {/* Both tabs stay mounted; display:none hides the inactive one.
              This preserves fetched data and avoids remount/refetch on every switch. */}
          <View style={[styles.tabContent, { opacity: 1 }, activeTab !== "workouts" && styles.hidden]}>
            <WorkoutStatistics
              selectedPeriod={selectedPeriod}
              dataPeriod={dataPeriod}
              onPeriodChange={handlePeriodChange}
              active={activeTab === "workouts"}
            />
          </View>

          <View style={[styles.tabContent, { opacity: 1 }, activeTab !== "nutrition" && styles.hidden]}>
            <NutritionStatistics
              selectedPeriod={selectedPeriod}
              dataPeriod={dataPeriod}
              onPeriodChange={handlePeriodChange}
              active={activeTab === "nutrition"}
            />
          </View>
        </ScrollView>
      </ScreenWrapper>
    </SwipeableScreen>
  );
});

Statistics.displayName = "Statistics";

export default Statistics;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  header: {
    paddingVertical: spacingY._15,
    alignItems: "center",
  },
  headerText: {
    textAlign: "center",
  },
  tabToggleContainer: {
    marginBottom: spacingY._15,
  },
  tabToggleCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    borderWidth: 2,
    borderColor: colors.neutral700,
    padding: spacingX._7,
  },
  stackedOuter: {
    position: "relative",
    marginRight: 6,
  },
  shadowRounded17: {
    position: "absolute",
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.cardShadow,
    borderRadius: radius._17,
  },
  segmentedControl: {
    height: verticalScale(45),
  },
  tabContent: {
    flex: 1,
  },
  hidden: {
    display: "none",
  },
});
