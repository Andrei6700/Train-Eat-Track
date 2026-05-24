import { spacingX, spacingY } from "@/constants/theme";
import { toDateKey } from "@/src/utils/dateKey";
import { verticalScale } from "@/src/utils/styling";
import { FlashList, ListRenderItem } from "@shopify/flash-list";
import React, { useCallback, useEffect, useRef } from "react";
import {
  InteractionManager,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
} from "react-native";
import HistoryDayCard, { ITEM_WIDTH } from "./HistoryDayCard";

export type HistoryCalendarStripProps = {
  calendarDays: Date[];
  selectedDateKey: string;
  initialIndex: number | null;
  historyDateSet: Set<string>;
  restDayDateSet: Set<string>;
  extraDataToken: string;
  onDayPress: (day: Date) => void;
  onVisibleMonthChange: (day: Date) => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const CalendarFlashList = FlashList as any;

const HistoryCalendarStrip = ({
  calendarDays,
  selectedDateKey,
  initialIndex,
  historyDateSet,
  restDayDateSet,
  extraDataToken,
  onDayPress,
  onVisibleMonthChange,
}: HistoryCalendarStripProps) => {
  const flashListRef = useRef<any>(null);
  const didInitialScrollRef = useRef(false);
  const lastReportedIndexRef = useRef<number | null>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();
  const todayKey = toDateKey(today);

  useEffect(() => {
    didInitialScrollRef.current = false;
    lastReportedIndexRef.current = null;
  }, [calendarDays.length, initialIndex]);

  useEffect(() => {
    if (initialIndex === null || didInitialScrollRef.current) return;
    if (calendarDays.length === 0 || !flashListRef.current) return;

    const maxIndex = Math.max(0, calendarDays.length - 1);
    const safeIndex = clamp(initialIndex, 0, maxIndex);

    const interaction = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        try {
          flashListRef.current?.scrollToIndex({
            index: safeIndex,
            animated: true,
            viewPosition: 0.5,
          });
          didInitialScrollRef.current = true;
        } catch {
          flashListRef.current?.scrollToOffset({
            offset: Math.max(0, safeIndex * ITEM_WIDTH),
            animated: true,
          });
          didInitialScrollRef.current = true;
        }
      });
    });

    return () => interaction.cancel();
  }, [calendarDays.length, initialIndex]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (calendarDays.length === 0) return;

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
        onVisibleMonthChange(visibleDay);
      }
    },
    [calendarDays, onVisibleMonthChange],
  );

  const keyExtractor = useCallback((item: Date, index: number) => {
    const time = item.getTime();
    return Number.isFinite(time) ? `${time}` : `fallback-${index}`;
  }, []);

  const renderDay: ListRenderItem<Date> = useCallback(
    ({ item: day }) => {
      const dayKey = toDateKey(day);

      return (
        <HistoryDayCard
          day={day}
          isToday={dayKey === todayKey}
          isSelected={dayKey === selectedDateKey}
          isFuture={day.getTime() > todayTimestamp}
          hasWorkout={historyDateSet.has(dayKey)}
          isRestDay={restDayDateSet.has(dayKey)}
          onPress={() => onDayPress(day)}
        />
      );
    },
    [
      historyDateSet,
      onDayPress,
      restDayDateSet,
      selectedDateKey,
      todayKey,
      todayTimestamp,
    ],
  );

  return (
    <View style={styles.calendarWrapper}>
      <CalendarFlashList
        ref={flashListRef}
        data={calendarDays}
        renderItem={renderDay}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.calendarContainer}

        onScroll={handleScroll}
        scrollEventThrottle={16}
        extraData={extraDataToken}
      />
    </View>
  );
};

export default React.memo(HistoryCalendarStrip);

const styles = StyleSheet.create({
  calendarWrapper: {
    height: verticalScale(90),
    marginBottom: spacingY._15,
  },
  calendarContainer: {
    paddingHorizontal: spacingX._5,
  },
});
