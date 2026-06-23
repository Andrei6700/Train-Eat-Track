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
  /**
   * #11 — bumped by the parent on each load session (focus/refresh). The strip
   * re-anchors the scroll to the selected day ONLY when this token changes,
   * NOT when older days are prepended within a session (which would yank the
   * view back to today during load-on-scroll).
   */
  sessionToken?: number;
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
  sessionToken,
}: HistoryCalendarStripProps) => {
  const flashListRef = useRef<any>(null);
  const didInitialScrollRef = useRef(false);
  const lastReportedIndexRef = useRef<number | null>(null);
  /** #11 — tracks the current horizontal scroll offset for prepend compensation. */
  const currentOffsetRef = useRef(0);
  /** #11 — tracks the previous calendar length to detect prepended days. */
  const prevLengthRef = useRef(calendarDays.length);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();
  const todayKey = toDateKey(today);

  // #11 — reset scroll anchoring ONLY on a new session (or initialIndex change),
  // NOT on calendarDays.length change. This prevents re-scrolling to today when
  // older pages are prepended during load-on-scroll.
  useEffect(() => {
    didInitialScrollRef.current = false;
    lastReportedIndexRef.current = null;
    prevLengthRef.current = calendarDays.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, initialIndex]);

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
          // Sync offset ref so prepend compensation starts from the right place.
          currentOffsetRef.current = safeIndex * ITEM_WIDTH;
        } catch {
          const fallbackOffset = Math.max(0, safeIndex * ITEM_WIDTH);
          flashListRef.current?.scrollToOffset({
            offset: fallbackOffset,
            animated: true,
          });
          didInitialScrollRef.current = true;
          currentOffsetRef.current = fallbackOffset;
        }
      });
    });

    return () => interaction.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarDays.length, initialIndex, sessionToken]);

  /**
   * #11 — preserve the visible day when older days are PREPENDED within a session.
   * Prepending shifts every existing day's index forward by `delta`; without
   * compensation the list would jump to show newer days. We shift the offset
   * forward by `delta * ITEM_WIDTH` to keep the same day in view.
   */
  useEffect(() => {
    const prevLen = prevLengthRef.current;
    const currLen = calendarDays.length;

    if (
      currLen > prevLen &&
      didInitialScrollRef.current &&
      flashListRef.current
    ) {
      const delta = currLen - prevLen;
      const nextOffset = currentOffsetRef.current + delta * ITEM_WIDTH;
      requestAnimationFrame(() => {
        try {
          flashListRef.current?.scrollToOffset({
            offset: nextOffset,
            animated: false,
          });
          currentOffsetRef.current = nextOffset;
        } catch {
          /* no-op: FlashList not ready yet */
        }
      });
    }
    prevLengthRef.current = currLen;
  }, [calendarDays.length]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (calendarDays.length === 0) return;

      const offsetX = event.nativeEvent.contentOffset.x;
      currentOffsetRef.current = offsetX; // #11 — keep offset ref in sync

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