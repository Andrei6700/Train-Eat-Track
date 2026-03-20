import { colors, spacingX, spacingY } from "@/constants/theme";
import { useLanguage } from "@/src/contexts/languageContext";
import { WEEK_DAY_SHORT_NAMES } from "@/src/i18n/translations";
import { toDateKey } from "@/src/utils/dateKey";
import { scale, verticalScale } from "@/src/utils/styling";
import { FlashList } from "@shopify/flash-list";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import Typo from "../ui/Typo";

const WEEK_DAYS_COUNT = 7;
const DAY_SPACING = spacingX._7 ?? 6;
const FALLBACK_DAY_WIDTH = scale(48);
const FALLBACK_PAGE_WIDTH =
  FALLBACK_DAY_WIDTH * WEEK_DAYS_COUNT + DAY_SPACING * (WEEK_DAYS_COUNT - 1);
const RING_VIEWBOX_SIZE = 52;
const RING_RADIUS = 22;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const CalendarFlashList = FlashList as any;

export type NutritionCalendarDayData = {
  date: Date;
  calories: number;
  goal: number;
};

type DayStatus = {
  type: "empty" | "complete" | "warning" | "danger" | "progress";
  percentage: number;
  color: string;
};

type NutritionCalendarProps = {
  calendarDays: Date[];
  daysData: NutritionCalendarDayData[];
  selectedDate?: Date;
  loading?: boolean;
  initialIndex?: number | null;
  extraDataToken?: string;
  scrollToDate?: Date | null;
  scrollToDateAnimated?: boolean;
  onScrollToDateHandled?: (date: Date) => void;
  onDayPress: (date: Date, index: number) => void;
  onVisibleDayChange?: (day: Date) => void;
};

const STATUS_EMPTY: DayStatus = {
  type: "empty",
  percentage: 0,
  color: colors.neutral700,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const startOfDay = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const dayKey = (date: Date): string => toDateKey(startOfDay(date));

const addDays = (date: Date, amount: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
};

const startOfWeekMonday = (date: Date): Date => {
  const normalized = startOfDay(date);
  const day = normalized.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(normalized, mondayOffset);
};

const buildWeekDays = (weekStart: Date): Date[] =>
  Array.from({ length: WEEK_DAYS_COUNT }, (_, index) =>
    addDays(weekStart, index),
  );

const getDayLabel = (date: Date, labels: string[]): string =>
  labels[date.getDay() === 0 ? 6 : date.getDay() - 1];

const getStatusForDay = (
  dayData: NutritionCalendarDayData | undefined,
): DayStatus => {
  if (!dayData || dayData.calories === 0) {
    return STATUS_EMPTY;
  }

  const percentage = (dayData.calories / dayData.goal) * 100;
  const excess = dayData.calories - dayData.goal;

  if (percentage >= 100 && excess <= 50) {
    return { type: "complete", percentage: 100, color: colors.chartSuccess };
  }
  if (percentage >= 100 && excess <= 350) {
    return { type: "warning", percentage: 100, color: colors.chartWarning };
  }
  if (percentage >= 100) {
    return { type: "danger", percentage: 100, color: colors.chartDanger };
  }

  return {
    type: "progress",
    percentage: Math.min(percentage, 100),
    color: colors.primary,
  };
};

type DayCardProps = {
  date: Date;
  dayWidth: number;
  isToday: boolean;
  isSelected: boolean;
  status: DayStatus;
  onPress: () => void;
};

const DayCardInner = ({
  date,
  dayWidth,
  isToday,
  isSelected,
  status,
  onPress,
}: DayCardProps) => {
  const { language } = useLanguage();
  const strokeDashoffset =
    RING_CIRCUMFERENCE - (status.percentage / 100) * RING_CIRCUMFERENCE;

  return (
    <TouchableOpacity
      style={[styles.dayCard, { width: dayWidth }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.dayContent}>
        <Typo
          size={11}
          fontWeight="600"
          color={isToday ? colors.primary : colors.neutral400}
          style={styles.dayLabel}
        >
          {getDayLabel(date, WEEK_DAY_SHORT_NAMES[language])}
        </Typo>

        <View
          style={[styles.ringContainer, { width: dayWidth, height: dayWidth }]}
        >
          <Svg
            width={dayWidth}
            height={dayWidth}
            viewBox={`0 0 ${RING_VIEWBOX_SIZE} ${RING_VIEWBOX_SIZE}`}
          >
            <Circle
              cx="26"
              cy="26"
              r={`${RING_RADIUS}`}
              stroke={colors.border}
              strokeWidth="3.5"
              fill="none"
            />
            {status.percentage > 0 && (
              <Circle
                cx="26"
                cy="26"
                r={`${RING_RADIUS}`}
                stroke={status.color}
                strokeWidth="3.5"
                fill="none"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                rotation="-90"
                origin="26, 26"
              />
            )}
          </Svg>

          <View style={styles.dayNumberContainer}>
            <View
              style={[
                styles.dayNumberContent,
                { minHeight: Math.max(dayWidth - 8, verticalScale(36)) },
              ]}
            >
              <Typo
                size={16}
                fontWeight="700"
                color={isSelected || isToday ? colors.primary : colors.white}
              >
                {date.getDate()}
              </Typo>
              {isSelected ? (
                <View style={styles.selectedIndicator} />
              ) : isToday ? (
                <View style={styles.todayIndicator} />
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const DayCard = React.memo(
  DayCardInner,
  (prevProps, nextProps) =>
    prevProps.dayWidth === nextProps.dayWidth &&
    prevProps.isToday === nextProps.isToday &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.status.percentage === nextProps.status.percentage &&
    prevProps.status.color === nextProps.status.color &&
    dayKey(prevProps.date) === dayKey(nextProps.date),
);
DayCard.displayName = "DayCard";

const NutritionCalendar = ({
  calendarDays,
  daysData,
  selectedDate,
  loading: externalLoading = false,
  initialIndex = null,
  extraDataToken,
  scrollToDate = null,
  scrollToDateAnimated = true,
  onScrollToDateHandled,
  onDayPress,
  onVisibleDayChange,
}: NutritionCalendarProps) => {
  const listRef = useRef<any>(null);
  const [pageWidth, setPageWidth] = useState(FALLBACK_PAGE_WIDTH);
  const [layoutReady, setLayoutReady] = useState(false);
  const lastReportedIndexRef = useRef<number | null>(null);
  const lastHandledScrollKeyRef = useRef<string | null>(null);
  const hasInitialAutoCenterRef = useRef(false);
  const autoCenteredSelectionWeekKeyRef = useRef<string | null>(null);
  const lastAutoCenteredIndexRef = useRef<number | null>(null);
  const didUserInteractRef = useRef(false);
  const pendingScrollToDateRef = useRef<{
    key: string;
    date: Date;
    index: number;
  } | null>(null);

  const todayKey = useMemo(() => dayKey(startOfDay(new Date())), []);
  const selectedDayKey = useMemo(
    () => (selectedDate ? dayKey(startOfDay(selectedDate)) : null),
    [selectedDate],
  );
  const selectedWeekKey = useMemo(
    () => (selectedDate ? dayKey(startOfWeekMonday(selectedDate)) : null),
    [selectedDate],
  );

  const dayDataByKey = useMemo(() => {
    const map = new Map<string, NutritionCalendarDayData>();
    for (const day of daysData) {
      map.set(dayKey(startOfDay(day.date)), day);
    }
    return map;
  }, [daysData]);

  const weekStartDates = useMemo(() => {
    if (calendarDays.length === 0) return [];

    const sortedDays = [...calendarDays].sort(
      (left, right) => left.getTime() - right.getTime(),
    );
    const firstWeekStart = startOfWeekMonday(sortedDays[0]);
    const lastDay = startOfDay(sortedDays[sortedDays.length - 1]);

    const weeks: Date[] = [];
    for (
      let cursor = firstWeekStart;
      cursor <= lastDay;
      cursor = addDays(cursor, WEEK_DAYS_COUNT)
    ) {
      weeks.push(cursor);
    }

    return weeks;
  }, [calendarDays]);

  const weekIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (let index = 0; index < weekStartDates.length; index += 1) {
      map.set(dayKey(weekStartDates[index]), index);
    }
    return map;
  }, [weekStartDates]);

  const findWeekIndexForDate = useCallback(
    (date: Date): number => {
      const weekKey = dayKey(startOfWeekMonday(date));
      return weekIndexByKey.get(weekKey) ?? -1;
    },
    [weekIndexByKey],
  );

  const safePageWidth = useMemo(
    () => (pageWidth > 0 ? pageWidth : FALLBACK_PAGE_WIDTH),
    [pageWidth],
  );

  const dayWidth = useMemo(() => {
    const available = safePageWidth - DAY_SPACING * (WEEK_DAYS_COUNT - 1);
    const computed = available / WEEK_DAYS_COUNT;
    return Math.max(verticalScale(42), computed);
  }, [safePageWidth]);

  const safeInitialWeekIndex = useMemo(() => {
    if (weekStartDates.length === 0) return 0;

    if (selectedDate) {
      const selectedWeekIndex = findWeekIndexForDate(selectedDate);
      if (selectedWeekIndex >= 0) return selectedWeekIndex;
    }

    if (
      initialIndex !== null &&
      initialIndex >= 0 &&
      initialIndex < calendarDays.length
    ) {
      const initialDate = calendarDays[initialIndex];
      const initialWeekIndex = findWeekIndexForDate(initialDate);
      if (initialWeekIndex >= 0) return initialWeekIndex;
    }

    const todayWeekIndex = findWeekIndexForDate(new Date());
    if (todayWeekIndex >= 0) return todayWeekIndex;

    return Math.max(weekStartDates.length - 1, 0);
  }, [
    calendarDays,
    findWeekIndexForDate,
    initialIndex,
    selectedDate,
    weekStartDates.length,
  ]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.max(event.nativeEvent.layout.width, 0);
    setPageWidth((previousWidth) =>
      Math.abs(previousWidth - nextWidth) < 1 ? previousWidth : nextWidth,
    );
    if (nextWidth > 0) {
      setLayoutReady(true);
    }
  }, []);

  // Auto-center on mount and on selection change.
  useEffect(() => {
    if (!layoutReady) return;
    if (!listRef.current) return;
    if (weekStartDates.length === 0) return;
    if (scrollToDate) return;

    const targetIndex = clamp(
      safeInitialWeekIndex,
      0,
      Math.max(weekStartDates.length - 1, 0),
    );
    const targetWeekStart = weekStartDates[targetIndex];
    if (!targetWeekStart) return;
    const targetWeekKey = dayKey(targetWeekStart);
    const shouldAutoCenterInitially = !hasInitialAutoCenterRef.current;
    const selectionChanged =
      selectedWeekKey !== null &&
      selectedWeekKey !== autoCenteredSelectionWeekKeyRef.current;
    const targetIndexShifted =
      lastAutoCenteredIndexRef.current !== null &&
      lastAutoCenteredIndexRef.current !== targetIndex;
    const shouldAutoCenterForShift =
      targetIndexShifted && !didUserInteractRef.current;
    const shouldAutoCenter =
      shouldAutoCenterInitially || selectionChanged || shouldAutoCenterForShift;

    if (!shouldAutoCenter) {
      return;
    }

    hasInitialAutoCenterRef.current = true;
    autoCenteredSelectionWeekKeyRef.current = selectedWeekKey ?? targetWeekKey;
    lastAutoCenteredIndexRef.current = targetIndex;

    // Skip scrollToIndex if we are already at the correct position.
    // Calling scrollToIndex when already there causes FlashList to briefly
    // flash the wrong week for 1-2 frames.
    const alreadyAtTarget =
      lastReportedIndexRef.current !== null &&
      lastReportedIndexRef.current === targetIndex;

    if (alreadyAtTarget) {
      return;
    }

    requestAnimationFrame(() => {
      if (!listRef.current) return;
      listRef.current.scrollToIndex({
        index: targetIndex,
        animated: selectionChanged,
        viewPosition: 0,
      });
      lastReportedIndexRef.current = targetIndex;
      onVisibleDayChange?.(targetWeekStart);
    });
  }, [
    layoutReady,
    onVisibleDayChange,
    safeInitialWeekIndex,
    scrollToDate,
    selectedWeekKey,
    weekStartDates,
  ]);

  useEffect(() => {
    if (!scrollToDate) {
      lastHandledScrollKeyRef.current = null;
      pendingScrollToDateRef.current = null;
      return;
    }

    if (weekStartDates.length === 0) return;

    const targetWeekKey = dayKey(startOfWeekMonday(scrollToDate));
    if (lastHandledScrollKeyRef.current === targetWeekKey) {
      return;
    }

    const targetIndex = weekIndexByKey.get(targetWeekKey);
    if (targetIndex === undefined) return;

    const attemptScroll = (attempt: number) => {
      if (!listRef.current) {
        if (attempt < 3) {
          requestAnimationFrame(() => attemptScroll(attempt + 1));
        }
        return;
      }

      pendingScrollToDateRef.current = {
        key: targetWeekKey,
        date: scrollToDate,
        index: targetIndex,
      };
      lastHandledScrollKeyRef.current = targetWeekKey;
      autoCenteredSelectionWeekKeyRef.current = targetWeekKey;
      lastAutoCenteredIndexRef.current = targetIndex;
      listRef.current.scrollToIndex({
        index: targetIndex,
        animated: scrollToDateAnimated,
        viewPosition: 0,
      });

      if (
        !scrollToDateAnimated ||
        lastReportedIndexRef.current === targetIndex
      ) {
        requestAnimationFrame(() => {
          const pending = pendingScrollToDateRef.current;
          if (!pending || pending.key !== targetWeekKey) return;

          onVisibleDayChange?.(pending.date);
          lastReportedIndexRef.current = targetIndex;
          pendingScrollToDateRef.current = null;
          onScrollToDateHandled?.(pending.date);
        });
      }
    };

    requestAnimationFrame(() => attemptScroll(0));
  }, [
    onScrollToDateHandled,
    onVisibleDayChange,
    scrollToDate,
    scrollToDateAnimated,
    weekIndexByKey,
    weekStartDates.length,
  ]);

  useEffect(() => {
    if (lastReportedIndexRef.current === null && weekStartDates.length > 0) {
      lastReportedIndexRef.current = safeInitialWeekIndex;
    }
  }, [safeInitialWeekIndex, weekStartDates.length]);

  const handleScrollBeginDrag = useCallback(() => {
    didUserInteractRef.current = true;
  }, []);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (weekStartDates.length === 0) return;

      const offsetX = event.nativeEvent.contentOffset.x;
      const pageWidth =
        event.nativeEvent.layoutMeasurement?.width || safePageWidth;
      const nextIndex = clamp(
        Math.round(offsetX / pageWidth),
        0,
        weekStartDates.length - 1,
      );

      const previousIndex = lastReportedIndexRef.current;
      const didIndexChange =
        previousIndex === null || previousIndex !== nextIndex;
      lastReportedIndexRef.current = nextIndex;

      if (didIndexChange) {
        const visibleWeekStart = weekStartDates[nextIndex];
        if (visibleWeekStart) {
          onVisibleDayChange?.(visibleWeekStart);
        }
      }

      const pending = pendingScrollToDateRef.current;
      if (!pending) return;

      pendingScrollToDateRef.current = null;
      onScrollToDateHandled?.(pending.date);
    },
    [onScrollToDateHandled, onVisibleDayChange, weekStartDates],
  );

  const renderWeek = useCallback(
    ({ item, index }: { item: Date; index: number }) => {
      const weekDays = buildWeekDays(item);

      return (
        <View style={[styles.weekPage, { width: safePageWidth }]}>
          {weekDays.map((date, dayIndex) => {
            const key = dayKey(date);
            const status = getStatusForDay(dayDataByKey.get(key));

            return (
              <View
                key={key}
                style={
                  dayIndex < WEEK_DAYS_COUNT - 1 ? styles.daySpacing : undefined
                }
              >
                <DayCard
                  date={date}
                  dayWidth={dayWidth}
                  isToday={key === todayKey}
                  isSelected={selectedDayKey === key}
                  status={status}
                  onPress={() =>
                    onDayPress(date, index * WEEK_DAYS_COUNT + dayIndex)
                  }
                />
              </View>
            );
          })}
        </View>
      );
    },
    [
      dayDataByKey,
      dayWidth,
      onDayPress,
      safePageWidth,
      selectedDayKey,
      todayKey,
    ],
  );

  const listExtraData = useMemo(
    () =>
      `${extraDataToken || "calendar"}-${selectedDayKey || "none"}-${dayWidth}`,
    [dayWidth, extraDataToken, selectedDayKey],
  );

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number }) => {
      const offset = safePageWidth * info.index;
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset, animated: false });
      });
    },
    [safePageWidth],
  );

  const keyExtractor = useCallback((item: Date, index: number) => {
    const timestamp = item.getTime();
    return Number.isFinite(timestamp) ? `${timestamp}` : `fallback-${index}`;
  }, []);

  const showList = layoutReady && !externalLoading && weekStartDates.length > 0;

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }, _item: Date, _index: number) => {
      layout.size = safePageWidth;
    },
    [safePageWidth],
  );

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {showList ? (
        <CalendarFlashList
          ref={listRef}
          data={weekStartDates}
          renderItem={renderWeek}
          keyExtractor={keyExtractor}
          horizontal
          pagingEnabled
          disableIntervalMomentum
          snapToInterval={safePageWidth}
          snapToAlignment="start"
          bounces={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.calendarContainer}
          style={styles.calendar}
          estimatedItemSize={safePageWidth}
          getItemType={() => "week"}
          overrideItemLayout={overrideItemLayout}
          initialScrollIndex={safeInitialWeekIndex}
          initialNumToRender={Math.min(weekStartDates.length, 3)}
          maxToRenderPerBatch={3}
          windowSize={5}
          decelerationRate="fast"
          onScrollBeginDrag={handleScrollBeginDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          extraData={listExtraData}
          onScrollToIndexFailed={handleScrollToIndexFailed}
        />
      ) : (
        <View style={styles.calendarPlaceholder} />
      )}
    </View>
  );
};

export default React.memo(NutritionCalendar);

const styles = StyleSheet.create({
  container: {
    marginBottom: spacingY._15,
  },
  calendar: {},
  calendarPlaceholder: {
    height: verticalScale(92),
  },
  calendarContainer: {
    paddingVertical: spacingY._5,
    paddingHorizontal: 0,
  },
  weekPage: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  daySpacing: {
    marginRight: DAY_SPACING,
  },
  dayCard: {
    alignItems: "center",
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  dayContent: {
    alignItems: "center",
  },
  dayLabel: {
    marginBottom: verticalScale(8),
    textAlign: "center",
  },
  ringContainer: {
    position: "relative",
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
  dayNumberContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  todayIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "transparent",
    marginTop: verticalScale(1),
  },
  selectedIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: verticalScale(1),
  },
});
