import { colors, spacingX, spacingY } from "@/constants/theme";
import { useLanguage } from "@/src/contexts/languageContext";
import { WEEK_DAY_SHORT_NAMES } from "@/src/i18n/translations";
import { scale, verticalScale } from "@/src/utils/styling";
import { FlashList } from "@shopify/flash-list";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import Typo from "../ui/Typo";

const DAY_WIDTH = scale(52);
const ITEM_SPACING = spacingX._7 ?? 6;
const ITEM_WIDTH = DAY_WIDTH + ITEM_SPACING;
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
  onDayPress: (date: Date, index: number) => void;
  onVisibleDayChange?: (day: Date) => void;
};

const STATUS_EMPTY: DayStatus = {
  type: "empty",
  percentage: 0,
  color: colors.neutral700,
};

const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

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
    return { type: "complete", percentage: 100, color: "#10B981" };
  }
  if (percentage >= 100 && excess <= 350) {
    return { type: "warning", percentage: 100, color: "#F59E0B" };
  }
  if (percentage >= 100) {
    return { type: "danger", percentage: 100, color: "#EF4444" };
  }

  return {
    type: "progress",
    percentage: Math.min(percentage, 100),
    color: colors.primary,
  };
};

type DayCardProps = {
  date: Date;
  isToday: boolean;
  isSelected: boolean;
  status: DayStatus;
  onPress: () => void;
};

const DayCardInner = ({ date, isToday, isSelected, status, onPress }: DayCardProps) => {
  const { language } = useLanguage();
  const circumference = 2 * Math.PI * 22;
  const strokeDashoffset = circumference - (status.percentage / 100) * circumference;

  return (
    <TouchableOpacity style={styles.dayCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.dayContent}>
        <Typo
          size={11}
          fontWeight="600"
          color={isToday ? colors.primary : colors.neutral400}
          style={styles.dayLabel}
        >
          {getDayLabel(date, WEEK_DAY_SHORT_NAMES[language])}
        </Typo>

        <View style={styles.ringContainer}>
          <Svg width={DAY_WIDTH} height={DAY_WIDTH} viewBox="0 0 52 52">
            <Circle
              cx="26"
              cy="26"
              r="22"
              stroke={colors.neutral700}
              strokeWidth="3.5"
              fill="none"
            />
            {status.percentage > 0 && (
              <Circle
                cx="26"
                cy="26"
                r="22"
                stroke={status.color}
                strokeWidth="3.5"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                rotation="-90"
                origin="26, 26"
              />
            )}
          </Svg>

          <View style={styles.dayNumberContainer}>
            <View style={styles.dayNumberContent}>
              <Typo size={20} fontWeight="700" color={isToday ? colors.primary : colors.white}>
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
    prevProps.isToday === nextProps.isToday &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.status.percentage === nextProps.status.percentage &&
    prevProps.status.color === nextProps.status.color &&
    prevProps.date.getDate() === nextProps.date.getDate(),
);
DayCard.displayName = "DayCard";

const NutritionCalendar = ({
  calendarDays,
  daysData,
  selectedDate,
  loading = false,
  initialIndex = null,
  extraDataToken,
  onDayPress,
  onVisibleDayChange,
}: NutritionCalendarProps) => {
  const listRef = useRef<any>(null);
  const didInitialScrollRef = useRef(false);
  const lastReportedIndexRef = useRef<number | null>(null);

  const todayKey = useMemo(() => dayKey(new Date()), []);
  const selectedDayKey = useMemo(
    () => (selectedDate ? dayKey(selectedDate) : null),
    [selectedDate],
  );

  const dayDataByKey = useMemo(() => {
    const map = new Map<string, NutritionCalendarDayData>();
    for (const day of daysData) {
      map.set(dayKey(day.date), day);
    }
    return map;
  }, [daysData]);

  const dayStatusByKey = useMemo(() => {
    const map = new Map<string, DayStatus>();
    for (const date of calendarDays) {
      const key = dayKey(date);
      map.set(key, getStatusForDay(dayDataByKey.get(key)));
    }
    return map;
  }, [calendarDays, dayDataByKey]);

  useEffect(() => {
    didInitialScrollRef.current = false;
    lastReportedIndexRef.current = null;
  }, [calendarDays.length, initialIndex]);

  useEffect(() => {
    if (calendarDays.length === 0) return;
    if (didInitialScrollRef.current) return;

    const todayIndex = calendarDays.findIndex((date) => dayKey(date) === todayKey);
    const fallbackIndex = todayIndex >= 0 ? todayIndex : Math.max(calendarDays.length - 1, 0);
    const maxIndex = Math.max(0, calendarDays.length - 1);
    const safeIndex = initialIndex === null ? fallbackIndex : clamp(initialIndex, 0, maxIndex);
    const visibleDay = calendarDays[safeIndex];

    const interaction = InteractionManager.runAfterInteractions(() => {
      try {
        listRef.current?.scrollToIndex({
          index: safeIndex,
          animated: false,
          viewPosition: 0.5,
        });
      } catch {
        listRef.current?.scrollToOffset({
          offset: safeIndex * ITEM_WIDTH,
          animated: false,
        });
      } finally {
        didInitialScrollRef.current = true;
      }

      if (visibleDay) {
        lastReportedIndexRef.current = safeIndex;
        onVisibleDayChange?.(visibleDay);
      }
    });

    return () => interaction.cancel();
  }, [calendarDays, initialIndex, onVisibleDayChange, todayKey]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (calendarDays.length === 0 || !onVisibleDayChange) return;

      const offsetX = event.nativeEvent.contentOffset.x;
      const nextIndex = clamp(
        Math.round(offsetX / ITEM_WIDTH),
        0,
        calendarDays.length - 1,
      );

      if (lastReportedIndexRef.current === nextIndex) return;
      lastReportedIndexRef.current = nextIndex;

      const visibleDay = calendarDays[nextIndex];
      if (visibleDay) {
        onVisibleDayChange(visibleDay);
      }
    },
    [calendarDays, onVisibleDayChange],
  );

  const renderDay = useCallback(
    ({ item, index }: { item: Date; index: number }) => {
      const key = dayKey(item);
      return (
        <DayCard
          date={item}
          isToday={key === todayKey}
          isSelected={selectedDayKey === key}
          status={dayStatusByKey.get(key) || STATUS_EMPTY}
          onPress={() => onDayPress(item, index)}
        />
      );
    },
    [dayStatusByKey, onDayPress, selectedDayKey, todayKey],
  );

  const listExtraData = useMemo(
    () => `${extraDataToken || "calendar"}-${selectedDayKey || "none"}`,
    [extraDataToken, selectedDayKey],
  );

  const keyExtractor = useCallback((item: Date, index: number) => {
    const timestamp = item.getTime();
    return Number.isFinite(timestamp) ? `${timestamp}` : `fallback-${index}`;
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CalendarFlashList
        ref={listRef}
        data={calendarDays}
        renderItem={renderDay}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.calendarContainer}
        style={styles.calendar}
        estimatedItemSize={ITEM_WIDTH}
        getItemType={() => "day"}
        getItemLayout={(_data: Date[] | null, index: number) => ({
          length: ITEM_WIDTH,
          offset: ITEM_WIDTH * index,
          index,
        })}
        initialNumToRender={Math.min(calendarDays.length, 14)}
        maxToRenderPerBatch={14}
        windowSize={7}
        removeClippedSubviews
        scrollEnabled
        snapToInterval={ITEM_WIDTH}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        extraData={listExtraData}
        ItemSeparatorComponent={Separator}
      />
    </View>
  );
};

const SeparatorInner = () => <View style={styles.separator} />;
const Separator = React.memo(SeparatorInner);
Separator.displayName = "CalendarSeparator";

export default React.memo(NutritionCalendar);

const styles = StyleSheet.create({
  container: {
    marginBottom: spacingY._15,
  },
  calendar: {},
  calendarContainer: {
    paddingVertical: spacingY._5,
    paddingHorizontal: 0,
  },
  loadingContainer: {
    height: verticalScale(95),
    justifyContent: "center",
    alignItems: "center",
  },
  dayCard: {
    alignItems: "center",
    paddingVertical: 0,
    paddingHorizontal: 0,
    width: DAY_WIDTH,
  },
  separator: {
    width: ITEM_SPACING,
  },
  dayContent: {
    alignItems: "center",
  },
  dayLabel: {
    marginBottom: verticalScale(8),
    textAlign: "center",
  },
  ringContainer: {
    width: DAY_WIDTH,
    height: DAY_WIDTH,
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
    minHeight: DAY_WIDTH - 6,
  },
  todayIndicator: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "transparent",
    marginTop: verticalScale(2),
  },
  selectedIndicator: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: verticalScale(2),
  },
});
