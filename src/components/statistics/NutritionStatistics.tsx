import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useLanguage } from "@/src/contexts/languageContext";
import { LOCALE_BY_LANGUAGE } from "@/src/i18n/translations";
import { getUserNutritionHistory } from "@/src/services/nutritionService";
import { getUserWaterHistory } from "@/src/services/waterService";
import { DailyNutrition, DailyWater } from "@/src/types/index";
import { scale, verticalScale } from "@/src/utils/styling";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import * as Icons from "phosphor-react-native";
import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions
} from "react-native";
import { LineChart } from "react-native-gifted-charts";

const MemoizedLineChart = React.memo(LineChart);

const ChartSkeleton = ({ color }: { color: string }) => (
  <View style={{ height: verticalScale(200), justifyContent: "center", alignItems: "center" }}>
    <ActivityIndicator size="small" color={color} />
  </View>
);

type PeriodType = "Weekly" | "Monthly" | "Yearly";
type NutritionChartType = "kcal" | "protein" | "fat" | "carbs";

type ChartDataPoint = {
  value: number;
  label: string;
  dataPointText?: string;
  textShiftY?: number;
  textFontSize?: number;
  textColor?: string;
};

type NutritionDayStats = {
  date: Date;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
};

interface NutritionStatisticsProps {
  selectedPeriod: PeriodType;
  dataPeriod: PeriodType;
  onPeriodChange: (period: PeriodType) => void;
  active: boolean;
}

const PERIODS: PeriodType[] = ["Weekly", "Monthly", "Yearly"];

const CHART_TYPE_CYCLE: NutritionChartType[] = ["kcal", "protein", "fat", "carbs"];

const CHART_TYPE_CONFIG: Record<NutritionChartType, {
  color: string;
  badge: string;
  field: keyof NutritionDayStats;
  suffix: string;
}> = {
  kcal:    { color: "#FFB020", badge: "kcal",      field: "calories", suffix: "" },
  protein: { color: "#22C55E", badge: "g protein", field: "protein",  suffix: "" },
  fat:     { color: "#FFB020", badge: "g fat",     field: "fat",      suffix: "" },
  carbs:   { color: "#7B61FF", badge: "g carbs",   field: "carbs",    suffix: "" },
};

const applyLabelFiltering = (points: ChartDataPoint[], suffix: string = ""): ChartDataPoint[] => {
  return points.map((pt, idx) => {
    const shiftY = idx % 2 === 0 ? 12 : -12;

    return {
      ...pt,
      dataPointText: `${pt.value}${suffix}`,
      textShiftY: shiftY,
      textFontSize: 10,
      textColor: "#F5F5F5",
    };
  });
};

const getPeriodStartDate = (period: PeriodType): Date => {
  const periodStart = new Date();
  periodStart.setHours(0, 0, 0, 0);

  if (period === "Weekly") {
    periodStart.setDate(periodStart.getDate() - 7);
  } else if (period === "Monthly") {
    periodStart.setMonth(periodStart.getMonth() - 1);
  } else {
    periodStart.setFullYear(periodStart.getFullYear() - 1);
  }

  return periodStart;
};

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(d.setDate(diff));
};

function NutritionStatistics({
  selectedPeriod,
  dataPeriod,
  onPeriodChange,
  active,
}: NutritionStatisticsProps) {
  const { user } = useAuth();
  const { language, t } = useLanguage();

  const [nutritionHistory, setNutritionHistory] = useState<DailyNutrition[]>([]);
  const [waterHistory, setWaterHistory] = useState<DailyWater[]>([]);
  const [loading, setLoading] = useState(true);

  const [nutritionChartType, setNutritionChartType] = useState<NutritionChartType>("kcal");

  const { width } = useWindowDimensions();
  const chartWidth = width - 48;
  const requestIdRef = useRef(0);
  const isSwipingRef = useRef(false);
  const swipeStartTimeRef = useRef(0);

  const renderStartTime = Date.now();
  const periodChangeRef = useRef<{ from: PeriodType; to: PeriodType; startTime: number } | null>(null);

  useEffect(() => {
    const renderDuration = Date.now() - renderStartTime;
    if (__DEV__) {
      console.log(`[STATS] NutritionStatistics - render: ${renderDuration}ms`);
    }
  });

  useEffect(() => {
    if (periodChangeRef.current && periodChangeRef.current.to === dataPeriod) {
      const duration = Date.now() - periodChangeRef.current.startTime;
      if (__DEV__) {
        console.log(`[STATS] Period change ${periodChangeRef.current.from.toLowerCase()}→${periodChangeRef.current.to.toLowerCase()}: ${duration}ms`);
      }
      periodChangeRef.current = null;
    }
  }, [dataPeriod]);

  // Swipe left → next period, swipe right → previous period
  const handleSwipePeriod = useCallback(
    (direction: "next" | "prev") => {
      const currentIdx = PERIODS.indexOf(selectedPeriod);
      let nextPeriod: PeriodType | null = null;
      if (direction === "next" && currentIdx < PERIODS.length - 1) {
        nextPeriod = PERIODS[currentIdx + 1];
      } else if (direction === "prev" && currentIdx > 0) {
        nextPeriod = PERIODS[currentIdx - 1];
      }
      if (nextPeriod) {
        periodChangeRef.current = {
          from: selectedPeriod,
          to: nextPeriod,
          startTime: Date.now(),
        };
        onPeriodChange(nextPeriod);
      }
    },
    [selectedPeriod, onPeriodChange]
  );

  const periodPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_: GestureResponderEvent, gs: PanResponderGestureState) => {
        const isHorizontal = Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 20;
        return isHorizontal;
      },
      onPanResponderGrant: () => {
        isSwipingRef.current = false;
        swipeStartTimeRef.current = Date.now();
      },
      onPanResponderMove: (_: GestureResponderEvent, gs: PanResponderGestureState) => {
        if (Math.abs(gs.dx) > 30 && !isSwipingRef.current) {
          isSwipingRef.current = true;
        }
      },
      onPanResponderRelease: (_: GestureResponderEvent, gs: PanResponderGestureState) => {
        const duration = Date.now() - swipeStartTimeRef.current;
        const isQuick = duration < 300 && Math.abs(gs.vx) > 0.3;
        const isLong = Math.abs(gs.dx) > 80;
        if (isQuick || isLong) {
          if (gs.dx < 0) {
            handleSwipePeriod("next");
          } else {
            handleSwipePeriod("prev");
          }
        }
        isSwipingRef.current = false;
      },
      onPanResponderTerminate: () => {
        isSwipingRef.current = false;
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSwipePeriod]);

  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    setChartReady(false);
    const t = setTimeout(() => {
      setChartReady(true);
    }, 50);
    return () => clearTimeout(t);
  }, [dataPeriod]);



  const getButtonLabel = (type: NutritionChartType) => {
    switch (type) {
      case "kcal":
        return t("statistics_kcal");
      case "protein":
        return t("nutrition_protein");
      case "fat":
        return t("nutrition_fat");
      case "carbs":
        return t("nutrition_carbs");
    }
  };

  const fetchNutritionAndWater = useCallback(async () => {
    const userId = user?.uid;
    const requestId = ++requestIdRef.current;
    if (!userId) {
      setNutritionHistory([]);
      setWaterHistory([]);
      setLoading(false);
      return;
    }

    const fetchStartTime = Date.now();
    if (__DEV__) {
      console.log(`[STATS] NutritionStatistics - fetch start: ${new Date().toISOString()}`);
    }

    setLoading(true);
    try {
      const [nutritionResult, waterResult] = await Promise.all([
        getUserNutritionHistory(userId),
        getUserWaterHistory(userId),
      ]);
      if (requestId !== requestIdRef.current) return;

      if (nutritionResult.success && Array.isArray(nutritionResult.data)) {
        setNutritionHistory(nutritionResult.data);
      }
      if (waterResult.success && Array.isArray(waterResult.data)) {
        setWaterHistory(waterResult.data);
      }
    } catch (error) {
      if (__DEV__) {
        console.error("Error fetching nutrition/water history:", error);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        const fetchDuration = Date.now() - fetchStartTime;
        if (__DEV__) {
          console.log(`[STATS] NutritionStatistics - fetch end: ${new Date().toISOString()}`);
          console.log(`[STATS] NutritionStatistics - fetch: ${fetchDuration}ms`);
        }
      }
    }
  }, [user?.uid]);

  useEffect(() => {
    void fetchNutritionAndWater();
    return () => {
      requestIdRef.current += 1;
    };
  }, [fetchNutritionAndWater]);

  // Memoized: daily aggregated stats within current period
  const rawNutritionDayStats = useMemo((): NutritionDayStats[] => {
    const start = Date.now();
    const periodStart = getPeriodStartDate(dataPeriod);
    const dayMap = new Map<string, NutritionDayStats>();

    for (const day of nutritionHistory) {
      const dayDate = new Date(day.date);
      dayDate.setHours(0, 0, 0, 0);
      if (dayDate < periodStart) continue;

      const key = dayDate.toISOString();
      const meals = Array.isArray(day.meals) ? day.meals : [];

      let calories = 0;
      let protein = 0;
      let carbs = 0;
      let fat = 0;
      for (const meal of meals) {
        const foods = Array.isArray(meal.foods) ? meal.foods : [];
        for (const food of foods) {
          calories += Number(food.calories) || 0;
          protein += Number(food.protein) || 0;
          carbs += Number(food.carbs) || 0;
          fat += Number(food.fat) || 0;
        }
      }

      if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) continue;

      dayMap.set(key, {
        date: dayDate,
        calories,
        protein,
        carbs,
        fat,
        water: 0,
      });
    }

    for (const day of waterHistory) {
      const dayDate = new Date(day.date);
      dayDate.setHours(0, 0, 0, 0);
      if (dayDate < periodStart) continue;

      const key = dayDate.toISOString();
      const existing = dayMap.get(key);
      if (existing) {
        existing.water = day.total || 0;
      } else if ((day.total || 0) > 0) {
        dayMap.set(key, {
          date: dayDate,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          water: day.total || 0,
        });
      }
    }

    const result = Array.from(dayMap.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
    const duration = Date.now() - start;
    if (__DEV__) {
      console.log(`[STATS] NutritionStatistics - filtered data memo: ${duration}ms`);
    }
    return result;
  }, [nutritionHistory, waterHistory, dataPeriod]);

  // Memoized: downsample to weekly averages for Yearly view (max ~52 points instead of 365)
  const nutritionDayStats = useMemo((): NutritionDayStats[] => {
    const start = Date.now();
    if (dataPeriod !== "Yearly") {
      const result = rawNutritionDayStats;
      const duration = Date.now() - start;
      if (__DEV__) {
        console.log(`[STATS] NutritionStatistics - filtered data memo (Yearly bypass): ${duration}ms`);
      }
      return result;
    }

    const weeklyGroups = new Map<
      string,
      {
        caloriesList: number[];
        proteinList: number[];
        carbsList: number[];
        fatList: number[];
        waterList: number[];
        date: Date;
      }
    >();

    rawNutritionDayStats.forEach((day) => {
      const startOfWeek = getStartOfWeek(day.date);
      const key = startOfWeek.toISOString();
      const existing = weeklyGroups.get(key);
      if (existing) {
        if (day.calories > 0) existing.caloriesList.push(day.calories);
        if (day.protein > 0) existing.proteinList.push(day.protein);
        if (day.carbs > 0) existing.carbsList.push(day.carbs);
        if (day.fat > 0) existing.fatList.push(day.fat);
        if (day.water > 0) existing.waterList.push(day.water);
      } else {
        weeklyGroups.set(key, {
          caloriesList: day.calories > 0 ? [day.calories] : [],
          proteinList: day.protein > 0 ? [day.protein] : [],
          carbsList: day.carbs > 0 ? [day.carbs] : [],
          fatList: day.fat > 0 ? [day.fat] : [],
          waterList: day.water > 0 ? [day.water] : [],
          date: startOfWeek,
        });
      }
    });

    const sortedWeeks = Array.from(weeklyGroups.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    const result = sortedWeeks.map((w) => {
      const avg = (list: number[]) =>
        list.length > 0 ? Math.round(list.reduce((s, v) => s + v, 0) / list.length) : 0;
      return {
        date: w.date,
        calories: avg(w.caloriesList),
        protein: avg(w.proteinList),
        carbs: avg(w.carbsList),
        fat: avg(w.fatList),
        water: avg(w.waterList),
      };
    });
    const duration = Date.now() - start;
    if (__DEV__) {
      console.log(`[STATS] NutritionStatistics - filtered data memo (Yearly downsample): ${duration}ms`);
    }
    return result;
  }, [rawNutritionDayStats, dataPeriod]);

  // Memoized: full averages including protein/carbs/fat for macros dashboard
  const nutritionAverages = useMemo(() => {
    const start = Date.now();
    if (nutritionDayStats.length === 0) {
      const result = { avgCalories: 0, avgProtein: 0, avgCarbs: 0, avgFat: 0, avgWater: 0 };
      const duration = Date.now() - start;
      if (__DEV__) {
        console.log(`[STATS] NutritionStatistics - averages memo: ${duration}ms`);
      }
      return result;
    }

    const daysWithCalories = nutritionDayStats.filter((d) => d.calories > 0);
    const daysWithWater = nutritionDayStats.filter((d) => d.water > 0);

    const avg = (days: NutritionDayStats[], key: keyof NutritionDayStats) =>
      days.length > 0
        ? Math.round(days.reduce((s, d) => s + (d[key] as number), 0) / days.length)
        : 0;

    const result = {
      avgCalories: avg(daysWithCalories, "calories"),
      avgProtein: avg(daysWithCalories, "protein"),
      avgCarbs: avg(daysWithCalories, "carbs"),
      avgFat: avg(daysWithCalories, "fat"),
      avgWater: avg(daysWithWater, "water"),
    };
    const duration = Date.now() - start;
    if (__DEV__) {
      console.log(`[STATS] NutritionStatistics - averages memo: ${duration}ms`);
    }
    return result;
  }, [nutritionDayStats]);

  // Memoized: active chart config
  const activeChartConfig = useMemo(() => CHART_TYPE_CONFIG[nutritionChartType], [nutritionChartType]);

  // Memoized: chart data for current macro type
  const nutritionChartData = useMemo((): ChartDataPoint[] => {
    const start = Date.now();
    const field = activeChartConfig.field;
    const rawPoints = nutritionDayStats
      .filter((d) => (d[field] as number) > 0)
      .map((d) => ({
        value: d[field] as number,
        label: d.date.toLocaleDateString(LOCALE_BY_LANGUAGE[language], {
          month: "short",
          day: "numeric",
        }),
      }));
    const result = applyLabelFiltering(rawPoints, activeChartConfig.suffix);
    const duration = Date.now() - start;
    if (__DEV__) {
      console.log(`[STATS] NutritionStatistics - chartData memo: ${duration}ms`);
    }
    return result;
  }, [nutritionDayStats, language, activeChartConfig]);

  const waterChartData = useMemo((): ChartDataPoint[] => {
    const start = Date.now();
    const rawPoints = nutritionDayStats
      .filter((d) => d.water > 0)
      .map((d) => ({
        value: d.water,
        label: d.date.toLocaleDateString(LOCALE_BY_LANGUAGE[language], {
          month: "short",
          day: "numeric",
        }),
      }));
    const result = applyLabelFiltering(rawPoints, "");
    const duration = Date.now() - start;
    if (__DEV__) {
      console.log(`[STATS] NutritionStatistics - water chartData memo: ${duration}ms`);
    }
    return result;
  }, [nutritionDayStats, language]);

  const nutritionChartSpacing = useMemo(() => {
    const pointCount = nutritionChartData.length;
    if (pointCount <= 1) return scale(60);

    const usableWidth = Math.max(chartWidth - scale(60), scale(180));
    const dynamicSpacing = usableWidth / (pointCount - 1);

    return Math.max(scale(35), Math.min(scale(60), dynamicSpacing));
  }, [chartWidth, nutritionChartData.length]);

  const waterChartSpacing = useMemo(() => {
    const pointCount = waterChartData.length;
    if (pointCount <= 1) return scale(60);

    const usableWidth = Math.max(chartWidth - scale(60), scale(180));
    const dynamicSpacing = usableWidth / (pointCount - 1);

    return Math.max(scale(35), Math.min(scale(60), dynamicSpacing));
  }, [chartWidth, waterChartData.length]);

  const handleSegmentChange = useCallback(
    (index: number) => {
      const nextPeriod = PERIODS[index];
      if (nextPeriod !== selectedPeriod) {
        periodChangeRef.current = {
          from: selectedPeriod,
          to: nextPeriod,
          startTime: Date.now(),
        };
        onPeriodChange(nextPeriod);
      }
    },
    [selectedPeriod, onPeriodChange]
  );

  const hasAnyNutritionHistory = useMemo(() => {
    return nutritionHistory.length > 0 || waterHistory.length > 0;
  }, [nutritionHistory, waterHistory]);

  if (loading && nutritionDayStats.length === 0) {
    return (
      <View style={styles.initialLoadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    // Wrap in swipeable container for period switching
    <View {...periodPanResponder.panHandlers}>
      {/* Period selector */}
      <View style={styles.segmentedContainer}>
        <View style={styles.stackedOuter}>
          <View style={styles.shadowRounded17} />
          <View style={styles.segmentedCard}>
            <SegmentedControl
              values={[
                t("statistics_period_weekly"),
                t("statistics_period_monthly"),
                t("statistics_period_yearly"),
              ]}
              selectedIndex={
                selectedPeriod === "Weekly"
                  ? 0
                  : selectedPeriod === "Monthly"
                  ? 1
                  : 2
              }
              onChange={(event) =>
                handleSegmentChange(event.nativeEvent.selectedSegmentIndex)
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

      {nutritionDayStats.length > 0 && (
        <>
          {/* ── Row 1: Calories + Water ── */}
          <View style={styles.statsContainer}>
            <View style={styles.stackedOuterFlex}>
              <View style={styles.shadowRounded17} />
              <View style={styles.statCard}>
                <Icons.FireIcon size={24} color={colors.chartWarning} weight="fill" />
                <Typo size={32} variant="metric" color={colors.chartWarning} style={styles.statMetricText}>
                  {nutritionAverages.avgCalories}
                </Typo>
                <Typo size={13} color={colors.neutral400} style={styles.statLabelText}>
                  {t("statistics_average_calories")}
                </Typo>
              </View>
            </View>

            <View style={styles.stackedOuterFlex}>
              <View style={styles.shadowRounded17} />
              <View style={styles.statCard}>
                <Icons.DropIcon size={24} color={colors.waterAccent} weight="fill" />
                <Typo size={32} variant="metric" color={colors.waterAccent} style={styles.statMetricText}>
                  {nutritionAverages.avgWater}
                </Typo>
                <Typo size={13} color={colors.neutral400} style={styles.statLabelText}>
                  {t("statistics_average_water")}
                </Typo>
              </View>
            </View>
          </View>

          {/* ── Row 2: Macros (Protein, Carbs, Fat) ── */}
          <View style={styles.statsContainer}>
            <View style={styles.stackedOuterFlex}>
              <View style={styles.shadowRounded17} />
              <View style={styles.statCard}>
                <Icons.EggIcon size={24} color={colors.macroProtein} weight="fill" />
                <Typo size={28} variant="metric" color={colors.macroProtein} style={styles.statMetricText}>
                  {nutritionAverages.avgProtein}g
                </Typo>
                <Typo size={13} color={colors.neutral400} style={styles.statLabelText}>
                  {t("statistics_average_protein")}
                </Typo>
              </View>
            </View>

            <View style={styles.stackedOuterFlex}>
              <View style={styles.shadowRounded17} />
              <View style={styles.statCard}>
                <Icons.BreadIcon size={24} color={colors.macroCarbs} weight="fill" />
                <Typo size={28} variant="metric" color={colors.macroCarbs} style={styles.statMetricText}>
                  {nutritionAverages.avgCarbs}g
                </Typo>
                <Typo size={13} color={colors.neutral400} style={styles.statLabelText}>
                  {t("statistics_average_carbs")}
                </Typo>
              </View>
            </View>

            <View style={styles.stackedOuterFlex}>
              <View style={styles.shadowRounded17} />
              <View style={styles.statCard}>
                <Icons.TrayIcon size={24} color={colors.macroFat} weight="fill" />
                <Typo size={28} variant="metric" color={colors.macroFat} style={styles.statMetricText}>
                  {nutritionAverages.avgFat}g
                </Typo>
                <Typo size={13} color={colors.neutral400} style={styles.statLabelText}>
                  {t("statistics_average_fat")}
                </Typo>
              </View>
            </View>
          </View>

          {/* Nutrition trend chart (kcal / protein / fat / carbs) */}
          {nutritionChartData.length > 0 && (
            <View style={styles.stackedOuterWithGap}>
              <View style={styles.shadowRounded17} />
              <View style={styles.chartContainer}>
                <View style={styles.chartHeader}>
                  <View style={styles.chartTitleRow}>
                    <Typo size={18} fontWeight="600" style={styles.chartTitle}>
                      {t("statistics_calories_chart_title")}
                    </Typo>
                  </View>
                  <View style={[styles.chartBadge, { backgroundColor: activeChartConfig.color + "33" }]}>
                    <Typo
                      size={13}
                      color={activeChartConfig.color}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={styles.chartBadgeText}
                    >
                      {activeChartConfig.badge}
                    </Typo>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.metricButtonsContainer}
                  style={styles.metricButtonsScrollView}
                >
                  {CHART_TYPE_CYCLE.map((type) => {
                    const isActive = nutritionChartType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        onPress={() => {
                          startTransition(() => {
                            setNutritionChartType(type);
                          });
                        }}
                        style={[
                          styles.metricButton,
                          isActive ? styles.metricButtonActive : styles.metricButtonInactive,
                        ]}
                      >
                        <Typo
                          size={13}
                          fontWeight={isActive ? "700" : "600"}
                          color={isActive ? "#000000" : "#6B6B6B"}
                        >
                          {getButtonLabel(type)}
                        </Typo>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View>
                  {chartReady ? (
                    <MemoizedLineChart
                      data={nutritionChartData}
                      width={chartWidth}
                      height={verticalScale(200)}
                      spacing={nutritionChartSpacing}
                      thickness={3}
                      color={activeChartConfig.color}
                      startFillColor={activeChartConfig.color}
                      endFillColor={activeChartConfig.color}
                      startOpacity={0.3}
                      endOpacity={0.1}
                      initialSpacing={scale(14)}
                      endSpacing={scale(14)}
                      noOfSections={4}
                      yAxisTextStyle={styles.chartYAxisText}
                      xAxisLabelTextStyle={styles.chartXAxisText}
                      hideRules
                      curved
                      areaChart
                      hideDataPoints={false}
                      dataPointsColor={activeChartConfig.color}
                      dataPointsRadius={4}
                      textShiftX={-5}
                      rotateLabel={true}
                      xAxisLabelsHeight={verticalScale(30)}
                      xAxisLabelsVerticalShift={5}
                      overflowTop={35}
                    />
                  ) : (
                    <ChartSkeleton color={activeChartConfig.color} />
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Water trend chart */}
          {waterChartData.length > 0 && (
            <View style={styles.stackedOuterWithGap}>
              <View style={styles.shadowRounded17} />
              <View style={styles.chartContainer}>
                <View style={styles.chartHeader}>
                  <Typo size={18} fontWeight="600" style={styles.chartTitle}>
                    {t("statistics_water_chart_title")}
                  </Typo>
                  <View style={styles.chartBadge}>
                    <Typo
                      size={13}
                      color={colors.white}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={styles.chartBadgeText}
                    >
                      {t("statistics_ml")}
                    </Typo>
                  </View>
                </View>

                <View>
                  {chartReady ? (
                    <MemoizedLineChart
                      data={waterChartData}
                      width={chartWidth}
                      height={verticalScale(200)}
                      spacing={waterChartSpacing}
                      thickness={3}
                      color={colors.waterAccent}
                      startFillColor={colors.waterAccent}
                      endFillColor={colors.waterAccent}
                      startOpacity={0.3}
                      endOpacity={0.1}
                      initialSpacing={scale(14)}
                      endSpacing={scale(14)}
                      noOfSections={4}
                      yAxisTextStyle={styles.chartYAxisText}
                      xAxisLabelTextStyle={styles.chartXAxisText}
                      hideRules
                      curved
                      areaChart
                      hideDataPoints={false}
                      dataPointsColor={colors.waterAccent}
                      dataPointsRadius={4}
                      textShiftX={-5}
                      rotateLabel={true}
                      xAxisLabelsHeight={verticalScale(30)}
                      xAxisLabelsVerticalShift={5}
                      overflowTop={35}
                    />
                  ) : (
                    <ChartSkeleton color={colors.waterAccent} />
                  )}
                </View>
              </View>
            </View>
          )}
        </>
      )}

      {/* Nutrition empty state */}
      {rawNutritionDayStats.length === 0 && (
        <View style={styles.emptyState}>
          <Icons.ForkKnifeIcon
            size={48}
            color={colors.neutral500}
            weight="fill"
          />
          <Typo
            size={18}
            fontWeight="600"
            color={colors.neutral200}
            style={styles.emptyStateTitle}
          >
            {dataPeriod === "Weekly" && hasAnyNutritionHistory
              ? t("statistics_no_nutrition_this_week")
              : t("statistics_no_nutrition_yet")}
          </Typo>
          <Typo
            size={14}
            color={colors.neutral400}
            style={styles.emptyStateSubtitle}
          >
            {dataPeriod === "Weekly" && hasAnyNutritionHistory
              ? t("statistics_log_nutrition_weekly")
              : t("statistics_start_logging_nutrition")}
          </Typo>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  initialLoadingContainer: {
    marginBottom: spacingY._12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: verticalScale(120),
  },
  segmentedContainer: {
    marginBottom: spacingY._20,
  },
  stackedOuter: {
    position: "relative",
    marginRight: 6,
  },
  stackedOuterWithGap: {
    position: "relative",
    marginRight: 6,
    marginBottom: spacingY._20,
  },
  stackedOuterFlex: {
    position: "relative",
    flex: 1,
    marginBottom: 6,
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
  segmentedCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    borderWidth: 2,
    borderColor: colors.neutral700,
    padding: spacingX._7,
  },
  segmentedControl: {
    height: verticalScale(45),
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacingY._20,
    gap: spacingX._10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._15,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.neutral700,
  },
  statMetricText: {
    marginTop: spacingY._7,
    textAlign: "center",
  },
  statLabelText: {
    textAlign: "center",
  },
  chartContainer: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    borderWidth: 2,
    borderColor: colors.neutral700,
    overflow: "hidden",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    rowGap: spacingY._7,
    columnGap: spacingX._10,
    marginBottom: spacingY._15,
  },
  chartTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
    flexShrink: 1,
  },
  cycleButton: {
    padding: 4,
    borderRadius: radius._6,
    backgroundColor: colors.neutral700,
  },
  chartTitle: {
    flexShrink: 1,
    textAlign: "center",
  },
  chartBadge: {
    backgroundColor: colors.neutral700,
    paddingHorizontal: spacingX._12,
    paddingVertical: verticalScale(4),
    borderRadius: radius._10,
    flexShrink: 1,
    maxWidth: "70%",
  },
  chartBadgeText: {
    flexShrink: 1,
    textAlign: "center",
  },
  chartYAxisText: {
    color: colors.neutral400,
    fontSize: verticalScale(12),
    textAlign: "center",
  },
  chartXAxisText: {
    color: colors.neutral400,
    fontSize: verticalScale(11),
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacingY._50,
  },
  emptyStateTitle: {
    marginTop: spacingY._15,
    textAlign: "center",
  },
  emptyStateSubtitle: {
    marginTop: spacingY._7,
    textAlign: "center",
  },
  metricButtonsScrollView: {
    marginBottom: spacingY._15,
  },
  metricButtonsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  metricButton: {
    height: 32,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  metricButtonActive: {
    backgroundColor: "#A8E10C",
  },
  metricButtonInactive: {
    backgroundColor: "#1E1E1E",
  },
});

const areEqual = (prevProps: NutritionStatisticsProps, nextProps: NutritionStatisticsProps) => {
  // If becoming or staying inactive → skip ALL re-renders
  if (!nextProps.active) return true;
  // Only re-render active component when data changes
  return (
    prevProps.dataPeriod === nextProps.dataPeriod &&
    prevProps.selectedPeriod === nextProps.selectedPeriod &&
    prevProps.onPeriodChange === nextProps.onPeriodChange
  );
};

export default React.memo(NutritionStatistics, areEqual);
