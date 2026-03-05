import { colors, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/src/utils/styling";
import { FlashList } from "@shopify/flash-list";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, InteractionManager, StyleSheet, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Typo from "../ui/Typo";

const DAYS_FULL = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sam", "Dum"];
const DAY_WIDTH = scale(52);
const ITEM_SPACING = spacingX._7 ?? 6;
const ITEM_WIDTH = DAY_WIDTH + ITEM_SPACING;
const CalendarFlashList = FlashList as any;

type DayData = {
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
  currentWeek: Date[];
  selectedDate: Date;
  daysData: DayData[];
  loading?: boolean;
  onDayPress: (date: Date, index: number) => void;
};

const STATUS_EMPTY: DayStatus = {
  type: "empty",
  percentage: 0,
  color: colors.neutral700,
};

const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const getDayLabel = (date: Date): string => DAYS_FULL[date.getDay() === 0 ? 6 : date.getDay() - 1];

const getStatusForDay = (dayData: DayData | undefined): DayStatus => {
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
  status: DayStatus;
  onPress: () => void;
};

const DayCardInner = ({ date, isToday, status, onPress }: DayCardProps) => {
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
          {getDayLabel(date)}
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
            <Typo size={20} fontWeight="700" color={isToday ? colors.primary : colors.white}>
              {date.getDate()}
            </Typo>
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
    prevProps.status.percentage === nextProps.status.percentage &&
    prevProps.status.color === nextProps.status.color &&
    prevProps.date.getDate() === nextProps.date.getDate(),
);
DayCard.displayName = "DayCard";

const NutritionCalendar = ({
  currentWeek,
  selectedDate: _selectedDate,
  daysData,
  loading = false,
  onDayPress,
}: NutritionCalendarProps) => {
  const listRef = useRef<any>(null);
  const initialScrollDoneRef = useRef(false);

  const todayKey = useMemo(() => dayKey(new Date()), []);

  const dayDataByKey = useMemo(() => {
    const map = new Map<string, DayData>();
    for (const day of daysData) {
      map.set(dayKey(day.date), day);
    }
    return map;
  }, [daysData]);

  const dayStatusByKey = useMemo(() => {
    const map = new Map<string, DayStatus>();
    for (const date of currentWeek) {
      const key = dayKey(date);
      map.set(key, getStatusForDay(dayDataByKey.get(key)));
    }
    return map;
  }, [currentWeek, dayDataByKey]);

  useEffect(() => {
    if (currentWeek.length === 0) return;
    if (initialScrollDoneRef.current) return;

    const todayIndex = currentWeek.findIndex((date) => dayKey(date) === todayKey);
    if (todayIndex < 0) return;

    const interaction = InteractionManager.runAfterInteractions(() => {
      try {
        listRef.current?.scrollToIndex({
          index: todayIndex,
          animated: false,
          viewPosition: 0.5,
        });
        initialScrollDoneRef.current = true;
      } catch {
        listRef.current?.scrollToOffset({
          offset: todayIndex * ITEM_WIDTH,
          animated: false,
        });
        initialScrollDoneRef.current = true;
      }
    });

    return () => interaction.cancel();
  }, [currentWeek, todayKey]);

  const renderDay = useCallback(
    ({ item, index }: { item: Date; index: number }) => {
      const key = dayKey(item);
      return (
        <DayCard
          date={item}
          isToday={key === todayKey}
          status={dayStatusByKey.get(key) || STATUS_EMPTY}
          onPress={() => onDayPress(item, index)}
        />
      );
    },
    [dayStatusByKey, onDayPress, todayKey],
  );

  const keyExtractor = useCallback((item: Date) => item.toISOString(), []);

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
        data={currentWeek}
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
        initialNumToRender={7}
        maxToRenderPerBatch={7}
        windowSize={7}
        removeClippedSubviews
        scrollEnabled
        snapToInterval={ITEM_WIDTH}
        decelerationRate="fast"
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
});
