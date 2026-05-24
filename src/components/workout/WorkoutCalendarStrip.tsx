import { spacingX } from "@/constants/theme";
import { FlashList, ListRenderItem } from "@shopify/flash-list";
import React, { useCallback, useEffect, useRef } from "react";
import {
  InteractionManager,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
} from "react-native";
import WorkoutDayCard, { ITEM_WIDTH } from "./WorkoutDayCard";
import { toDateKey } from "@/src/utils/dateKey";
import { verticalScale } from "@/src/utils/styling";

export type WorkoutCalendarStripProps = {
  calendarDays: Date[];
  selectedDayKey: string;
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

const WorkoutCalendarStrip = ({
  calendarDays,
  selectedDayKey,
  initialIndex,
  historyDateSet,
  restDayDateSet,
  extraDataToken,
  onDayPress,
  onVisibleMonthChange,
}: WorkoutCalendarStripProps) => {
  const flashListRef = useRef<any>(null);
  const didInitialScrollRef = useRef(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();
  const todayKey = toDateKey(today);

  useEffect(() => {
    didInitialScrollRef.current = false;
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

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (calendarDays.length === 0) return;

      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / ITEM_WIDTH);
      const clampedIndex = clamp(index, 0, calendarDays.length - 1);
      const visibleDay = calendarDays[clampedIndex];

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
      const isFuture = day.getTime() > todayTimestamp;

      return (
        <WorkoutDayCard
          day={day}
          isTodayCard={dayKey === todayKey}
          isSelected={dayKey === selectedDayKey}
          isFuture={isFuture}
          hasWorkoutOnDay={historyDateSet.has(dayKey)}
          isRestDay={restDayDateSet.has(dayKey)}
          onPress={() => onDayPress(day)}
        />
      );
    },
    [
      historyDateSet,
      onDayPress,
      restDayDateSet,
      selectedDayKey,
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

        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        extraData={extraDataToken}
      />
    </View>
  );
};

export default React.memo(WorkoutCalendarStrip);

const styles = StyleSheet.create({
  calendarWrapper: {
    height: verticalScale(90),
  },
  calendarContainer: {
    paddingHorizontal: spacingX._5,
  },
});
