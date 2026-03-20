import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Typo from "@/src/components/ui/Typo";
import { NutritionCalendarDayData } from "@/src/components/ui/NutritionCalendar";
import { useLanguage } from "@/src/contexts/languageContext";
import { MONTH_NAMES, WEEK_DAY_SHORT_NAMES } from "@/src/i18n/translations";
import { DAY_IN_MS, startOfDay, toDateKey } from "@/src/utils/dateKey";
import { verticalScale } from "@/src/utils/styling";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import * as Icons from "phosphor-react-native";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type NutritionCalendarLogModalProps = {
  visible: boolean;
  calendarDays: Date[];
  daysData: NutritionCalendarDayData[];
  selectedDate: Date;
  maxSelectableDate: Date;
  loading?: boolean;
  onClose: () => void;
  onDaySelect: (day: Date, index?: number) => void;
};

type DayStatus = {
  type: "empty" | "complete" | "warning" | "danger" | "progress";
  percentage: number;
  color: string;
};

const CIRCLE_SIZE = 50;
const CIRCLE_RADIUS = 20;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

const STATUS_EMPTY: DayStatus = {
  type: "empty",
  percentage: 0,
  color: colors.neutral350,
};

const ORANGE = colors.chartWarning;
const RED = colors.chartDanger;
const CYAN = colors.primary;
const GREEN = colors.chartSuccess;

const startOfMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const isSameMonth = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();

const getMonthTitle = (language: "en" | "ro", monthDate: Date): string => {
  const monthName = MONTH_NAMES[language][monthDate.getMonth()];
  const normalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${normalizedMonth} ${monthDate.getFullYear()}`;
};

const getStatusForDay = (
  dayData: NutritionCalendarDayData | undefined,
): DayStatus => {
  if (!dayData || dayData.calories === 0) {
    return STATUS_EMPTY;
  }

  const percentage = (dayData.calories / dayData.goal) * 100;
  const excess = dayData.calories - dayData.goal;

  if (percentage >= 100 && excess <= 50) {
    return { type: "complete", percentage: 100, color: GREEN };
  }
  if (percentage >= 100 && excess <= 350) {
    return { type: "warning", percentage: 100, color: ORANGE };
  }
  if (percentage >= 100) {
    return { type: "danger", percentage: 100, color: RED };
  }

  return {
    type: "progress",
    percentage: Math.min(percentage, 100),
    color: CYAN,
  };
};

const buildMonthCells = (monthDate: Date): (Date | null)[] => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    cells.push(new Date(year, month, dayNumber));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

const parseDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const NutritionCalendarLogModal = ({
  visible,
  calendarDays,
  daysData,
  selectedDate,
  maxSelectableDate,
  loading = false,
  onClose,
  onDaySelect,
}: NutritionCalendarLogModalProps) => {
  const { language, t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [activeMonth, setActiveMonth] = useState<Date>(() =>
    startOfMonth(startOfDay(selectedDate)),
  );

  useEffect(() => {
    if (!visible) return;
    setActiveMonth(startOfMonth(startOfDay(selectedDate)));
  }, [selectedDate, visible]);

  const today = useMemo(() => startOfDay(new Date()), []);
  const maxSelectableDay = useMemo(
    () => startOfDay(maxSelectableDate),
    [maxSelectableDate],
  );
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const selectedKey = useMemo(() => toDateKey(startOfDay(selectedDate)), [selectedDate]);

  const earliestLoggedDay = useMemo(() => {
    if (daysData.length === 0) return null;

    let earliest = startOfDay(daysData[0].date);
    for (const day of daysData) {
      const candidate = startOfDay(day.date);
      if (candidate < earliest) {
        earliest = candidate;
      }
    }

    return earliest;
  }, [daysData]);

  const minMonth = useMemo(() => {
    if (earliestLoggedDay) return startOfMonth(earliestLoggedDay);
    if (calendarDays.length > 0) return startOfMonth(calendarDays[0]);
    return startOfMonth(today);
  }, [calendarDays, earliestLoggedDay, today]);

  const maxMonth = useMemo(
    () => startOfMonth(maxSelectableDay),
    [maxSelectableDay],
  );

  const canGoPreviousMonth = useMemo(
    () => !isSameMonth(activeMonth, minMonth),
    [activeMonth, minMonth],
  );
  const canGoNextMonth = useMemo(
    () => !isSameMonth(activeMonth, maxMonth),
    [activeMonth, maxMonth],
  );

  const dayDataByKey = useMemo(() => {
    const map = new Map<string, NutritionCalendarDayData>();
    for (const day of daysData) {
      map.set(toDateKey(startOfDay(day.date)), day);
    }
    return map;
  }, [daysData]);

  const monthCells = useMemo(() => buildMonthCells(activeMonth), [activeMonth]);
  const monthDaysCount = useMemo(
    () => new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 0).getDate(),
    [activeMonth],
  );

  const monthStats = useMemo(() => {
    let complete = 0;
    let warning = 0;
    let danger = 0;

    for (let dayNumber = 1; dayNumber <= monthDaysCount; dayNumber += 1) {
      const date = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), dayNumber);
      const status = getStatusForDay(dayDataByKey.get(toDateKey(date)));
      if (status.type === "complete") complete += 1;
      if (status.type === "warning") warning += 1;
      if (status.type === "danger") danger += 1;
    }

    return {
      complete,
      warning,
      danger,
      total: monthDaysCount,
    };
  }, [activeMonth, dayDataByKey, monthDaysCount]);

  const loggedDateSet = useMemo(() => {
    const set = new Set<string>();
    for (const day of daysData) {
      if (day.calories > 0) {
        set.add(toDateKey(startOfDay(day.date)));
      }
    }
    return set;
  }, [daysData]);

  const currentStreak = useMemo(() => {
    let streak = 0;
    let cursor = startOfDay(new Date());

    while (loggedDateSet.has(toDateKey(cursor))) {
      streak += 1;
      cursor = new Date(cursor.getTime() - DAY_IN_MS);
    }

    return streak;
  }, [loggedDateSet]);

  const bestStreak = useMemo(() => {
    if (loggedDateSet.size === 0) return 0;

    const sortedDates = [...loggedDateSet]
      .map(parseDateKey)
      .sort((left, right) => left.getTime() - right.getTime());

    let longest = 1;
    let current = 1;

    for (let index = 1; index < sortedDates.length; index += 1) {
      const previous = startOfDay(sortedDates[index - 1]).getTime();
      const currentTime = startOfDay(sortedDates[index]).getTime();

      if (currentTime - previous === DAY_IN_MS) {
        current += 1;
        if (current > longest) longest = current;
      } else if (currentTime !== previous) {
        current = 1;
      }
    }

    return longest;
  }, [loggedDateSet]);

  const handlePreviousMonth = useCallback(() => {
    if (!canGoPreviousMonth) return;
    setActiveMonth((previousMonth) =>
      new Date(previousMonth.getFullYear(), previousMonth.getMonth() - 1, 1),
    );
  }, [canGoPreviousMonth]);

  const handleNextMonth = useCallback(() => {
    if (!canGoNextMonth) return;
    setActiveMonth((previousMonth) =>
      new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 1),
    );
  }, [canGoNextMonth]);

  const handleTodayPress = useCallback(() => {
    const normalizedToday = startOfDay(new Date());
    setActiveMonth(startOfMonth(normalizedToday));
    onDaySelect(normalizedToday);
  }, [onDaySelect]);

  const handleDayPress = useCallback(
    (day: Date) => {
      if (startOfDay(day) > maxSelectableDay) return;
      onDaySelect(startOfDay(day), day.getDate() - 1);
    },
    [maxSelectableDay, onDaySelect],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + spacingY._10,
          },
        ]}
      >
        <View style={styles.topRow}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton}>
            <Icons.X size={verticalScale(26)} color={colors.neutral200} weight="bold" />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleTodayPress} style={styles.todayButton}>
            <Typo size={18} fontWeight="700" color={CYAN}>
              {t("nutrition_log_today")}
            </Typo>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingBottom: insets.bottom + spacingY._20,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.calendarCard}>
            <View style={styles.monthRow}>
              <TouchableOpacity
                onPress={handlePreviousMonth}
                disabled={!canGoPreviousMonth}
                style={styles.monthArrowButton}
              >
                <Icons.CaretLeft
                  size={verticalScale(26)}
                  color={canGoPreviousMonth ? CYAN : colors.neutral600}
                  weight="bold"
                />
              </TouchableOpacity>

              <Typo size={22} fontWeight="600" color={colors.neutral200}>
                {getMonthTitle(language, activeMonth)}
              </Typo>

              <TouchableOpacity
                onPress={handleNextMonth}
                disabled={!canGoNextMonth}
                style={styles.monthArrowButton}
              >
                <Icons.CaretRight
                  size={verticalScale(26)}
                  color={canGoNextMonth ? CYAN : colors.neutral600}
                  weight="bold"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.weekHeaderRow}>
              {WEEK_DAY_SHORT_NAMES[language].map((weekDayName) => (
                <View key={weekDayName} style={styles.weekHeaderCell}>
                  <Typo size={18} fontWeight="500" color={colors.neutral200}>
                    {weekDayName}
                  </Typo>
                </View>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {monthCells.map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }

                const dayKey = toDateKey(day);
                const status = getStatusForDay(dayDataByKey.get(dayKey));
                const isSelected = dayKey === selectedKey;
                const isTodayCard = dayKey === todayKey;
                const strokeDashoffset =
                  CIRCLE_CIRCUMFERENCE - (status.percentage / 100) * CIRCLE_CIRCUMFERENCE;

                return (
                  <View key={dayKey} style={styles.dayCell}>
                    <TouchableOpacity
                      onPress={() => handleDayPress(day)}
                      style={styles.dayButton}
                      disabled={startOfDay(day) > maxSelectableDay || loading}
                      activeOpacity={0.8}
                    >
                      <View style={styles.dayCircleWrapper}>
                        <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} viewBox="0 0 50 50">
                          <Circle
                            cx="25"
                            cy="25"
                            r={CIRCLE_RADIUS}
                            stroke={colors.neutral350}
                            strokeWidth="3.5"
                            fill="none"
                          />
                          {status.percentage > 0 && (
                            <Circle
                              cx="25"
                              cy="25"
                              r={CIRCLE_RADIUS}
                              stroke={status.color}
                              strokeWidth="3.5"
                              fill="none"
                              strokeDasharray={CIRCLE_CIRCUMFERENCE}
                              strokeDashoffset={strokeDashoffset}
                              strokeLinecap="round"
                              rotation="-90"
                              origin="25, 25"
                            />
                          )}
                        </Svg>
                        <View style={styles.dayNumberContainer}>
                          <Typo
                            size={19}
                            fontWeight="500"
                            color={
                              isSelected
                                ? CYAN
                                : isTodayCard
                                  ? colors.primary
                                  : colors.neutral200
                            }
                          >
                            {day.getDate()}
                          </Typo>
                          {isSelected && <View style={styles.selectedDot} />}
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Typo size={42}>😎</Typo>
              <View style={[styles.summaryBadge, { backgroundColor: GREEN }]}>
                <Typo size={17} fontWeight="700" color={colors.white}>
                  {monthStats.complete}/{monthStats.total}
                </Typo>
              </View>
              <Typo size={14} color={colors.neutral200} style={styles.summaryText}>
                {t("nutrition_log_within_goal")}
              </Typo>
            </View>

            <View style={styles.summaryItem}>
              <Typo size={42}>🙂</Typo>
              <View style={[styles.summaryBadge, { backgroundColor: ORANGE }]}>
                <Typo size={17} fontWeight="700" color={colors.white}>
                  {monthStats.warning}/{monthStats.total}
                </Typo>
              </View>
              <Typo size={14} color={colors.neutral200} style={styles.summaryText}>
                {t("nutrition_log_slightly_over")}
              </Typo>
            </View>

            <View style={styles.summaryItem}>
              <Typo size={42}>😳</Typo>
              <View style={[styles.summaryBadge, { backgroundColor: RED }]}>
                <Typo size={17} fontWeight="700" color={colors.white}>
                  {monthStats.danger}/{monthStats.total}
                </Typo>
              </View>
              <Typo size={14} color={colors.neutral200} style={styles.summaryText}>
                {t("nutrition_log_over_goal")}
              </Typo>
            </View>
          </View>

          <View style={styles.chainCard}>
            <View style={styles.chainHeader}>
              <Typo size={20} fontWeight="700" color={colors.neutral200}>
                {t("nutrition_log_chain_title")}
              </Typo>
              <Icons.Info size={verticalScale(30)} color={CYAN} weight="regular" />
            </View>

            <View style={styles.chainRow}>
              <Icons.CalendarBlank size={verticalScale(26)} color={colors.neutral400} weight="regular" />
              <Typo size={18} fontWeight="700" color={colors.neutral100} style={styles.chainText}>
                {t("nutrition_log_current_streak", { count: currentStreak })}
              </Typo>
            </View>

            <View style={styles.chainRow}>
              <Icons.CrownSimple size={verticalScale(26)} color={colors.chartWarning} weight="fill" />
              <Typo size={18} fontWeight="500" color={colors.neutral200} style={styles.chainText}>
                {t("nutrition_log_best_streak", { count: bestStreak })}
              </Typo>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

export default React.memo(NutritionCalendarLogModal);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral900,
    paddingHorizontal: spacingX._20,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacingY._15,
  },
  iconButton: {
    width: verticalScale(38),
    height: verticalScale(38),
    borderRadius: radius._12,
    alignItems: "center",
    justifyContent: "center",
  },
  todayButton: {
    paddingHorizontal: spacingX._10,
    paddingVertical: spacingY._5,
  },
  scroll: {
    flex: 1,
  },
  calendarCard: {
    backgroundColor: colors.neutral700,
    borderRadius: radius._20,
    paddingVertical: spacingY._20,
    paddingHorizontal: spacingX._15,
    marginBottom: spacingY._20,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacingY._20,
  },
  monthArrowButton: {
    width: verticalScale(38),
    height: verticalScale(38),
    alignItems: "center",
    justifyContent: "center",
  },
  weekHeaderRow: {
    flexDirection: "row",
    marginBottom: spacingY._10,
  },
  weekHeaderCell: {
    width: "14.285%",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.285%",
    alignItems: "center",
    marginBottom: spacingY._10,
  },
  dayButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleWrapper: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumberContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedDot: {
    width: verticalScale(7),
    height: verticalScale(7),
    borderRadius: verticalScale(4),
    backgroundColor: CYAN,
    marginTop: verticalScale(2),
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacingY._20,
  },
  summaryItem: {
    width: "31%",
    alignItems: "center",
  },
  summaryBadge: {
    minWidth: verticalScale(86),
    borderRadius: radius._30,
    paddingVertical: spacingY._7,
    paddingHorizontal: spacingX._15,
    alignItems: "center",
    marginTop: spacingY._7,
    marginBottom: spacingY._10,
  },
  summaryText: {
    textAlign: "center",
    lineHeight: verticalScale(21),
  },
  chainCard: {
    backgroundColor: colors.neutral700,
    borderRadius: radius._20,
    padding: spacingX._20,
  },
  chainHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacingY._20,
  },
  chainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacingX._12,
    marginBottom: spacingY._17,
  },
  chainText: {
    flex: 1,
    lineHeight: verticalScale(31),
  },
});
