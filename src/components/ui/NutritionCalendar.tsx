import { colors, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/src/utils/styling";
import React, { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Typo from "../ui/Typo";

const DAYS_FULL = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"];
const DAY_WIDTH = scale(52);
const ITEM_SPACING = spacingX._8 ?? 6;
const ITEM_WIDTH = DAY_WIDTH + ITEM_SPACING;

type DayData = {
  date: Date;
  calories: number;
  goal: number;
};

type NutritionCalendarProps = {
  currentWeek: Date[];
  selectedDate: Date;
  daysData: DayData[];
  loading?: boolean;
  onDayPress: (date: Date, index: number) => void;
};

const DayCard = React.memo(({ 
  date, 
  index, 
  isSelected, 
  isToday, 
  status, 
  onPress 
}: { 
  date: Date; 
  index: number; 
  isSelected: boolean; 
  isToday: boolean; 
  status: { type: string; percentage: number; color: string }; 
  onPress: () => void;
}) => {
  const circumference = 2 * Math.PI * 22;
  const strokeDashoffset = circumference - (status.percentage / 100) * circumference;

  const getDayNumberColor = () => {
    if (isToday) return colors.primary;
    if (isSelected) return colors.white;
    return colors.white;
  };

  const getDayLabelColor = () => {
    if (isToday) return colors.primary; 
    return colors.neutral400; 
  };

  return (
    <TouchableOpacity
      style={[
        styles.dayCard,
        { marginRight: index === 6 ? 0 : ITEM_SPACING },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.dayContent}>
        {/* number of the day  */}
        <Typo
          size={11}
          fontWeight="600"
          color={getDayLabelColor()}
          style={styles.dayLabel}
        >
          {DAYS_FULL[date.getDay() === 0 ? 6 : date.getDay() - 1]}
        </Typo>

        <View style={styles.ringContainer}>
          <Svg width={DAY_WIDTH} height={DAY_WIDTH} viewBox="0 0 52 52">
            {/* Background circle */}
            <Circle
              cx="26"
              cy="26"
              r="22"
              stroke={colors.neutral700}
              strokeWidth="3.5"
              fill="none"
            />
            {/* Progress circle */}
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
          
          {/* number of the day  */}
          <View style={styles.dayNumberContainer}>
            <Typo
              size={20}
              fontWeight="700"
              color={getDayNumberColor()}
            >
              {date.getDate()}
            </Typo>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isToday === nextProps.isToday &&
    prevProps.status.percentage === nextProps.status.percentage &&
    prevProps.status.color === nextProps.status.color
  );
});

const NutritionCalendar = ({
  currentWeek,
  selectedDate,
  daysData,
  loading = false,
  onDayPress,
}: NutritionCalendarProps) => {
  const flatListRef = useRef<FlatList>(null);
  const initialScrollDone = useRef(false);

  const dayStatusCache = useMemo(() => {
    const cache = new Map();
    
    currentWeek.forEach((date) => {
      const dayData = daysData.find(
        (d) => d.date.toDateString() === date.toDateString()
      );

      if (!dayData || dayData.calories === 0) {
        cache.set(date.toDateString(), { 
          type: 'empty', 
          percentage: 0, 
          color: colors.neutral700 
        });
      } else {
        const percentage = (dayData.calories / dayData.goal) * 100;
        const excess = dayData.calories - dayData.goal;

        let status;
        if (percentage >= 100 && excess <= 50) {
          status = { type: 'complete', percentage: 100, color: '#10B981' };
        } else if (percentage >= 100 && excess > 50 && excess <= 350) {
          status = { type: 'warning', percentage: 100, color: '#F59E0B' };
        } else if (percentage >= 100 && excess > 350) {
          status = { type: 'danger', percentage: 100, color: '#EF4444' };
        } else {
          status = { type: 'progress', percentage: Math.min(percentage, 100), color: colors.primary };
        }
        
        cache.set(date.toDateString(), status);
      }
    });

    return cache;
  }, [daysData, currentWeek]);

  useEffect(() => {
    if (!initialScrollDone.current && currentWeek.length > 0) {
      const todayIndex = currentWeek.findIndex(
        (d) => d.toDateString() === new Date().toDateString()
      );
      
      if (todayIndex !== -1 && flatListRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: todayIndex,
            animated: false,
            viewPosition: 0.5,
          });
          initialScrollDone.current = true;
        }, 50);
      }
    }
  }, [currentWeek]);

  const renderDay = ({ item: date, index }: { item: Date; index: number }) => {
    const isSelected = date.toDateString() === selectedDate.toDateString();
    const isToday = date.toDateString() === new Date().toDateString();
    const status = dayStatusCache.get(date.toDateString()) || { 
      type: 'empty', 
      percentage: 0, 
      color: colors.neutral700 
    };

    return (
      <DayCard
        date={date}
        index={index}
        isSelected={isSelected}
        isToday={isToday}
        status={status}
        onPress={() => onDayPress(date, index)}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={currentWeek}
        renderItem={renderDay}
        keyExtractor={(item) => item.toISOString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.calendarContainer}
        style={styles.calendar}
        getItemLayout={(data, index) => ({
          length: ITEM_WIDTH,
          offset: ITEM_WIDTH * index,
          index,
        })}
        initialNumToRender={7}
        maxToRenderPerBatch={7}
        windowSize={7}
        removeClippedSubviews={true}
        scrollEnabled={true}
        snapToInterval={ITEM_WIDTH}
        decelerationRate="fast"
      />
    </View>
  );
};

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
  dayContent: {
    alignItems: 'center',
  },
  dayLabel: {
    marginBottom: verticalScale(8),
    textAlign: 'center',
  },
  ringContainer: {
    width: DAY_WIDTH,
    height: DAY_WIDTH,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});