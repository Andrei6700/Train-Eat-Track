import { colors, radius, spacingY } from "@/constants/theme";
import { useLanguage } from "@/src/contexts/languageContext";
import { WEEK_DAY_SHORT_NAMES } from "@/src/i18n/translations";
import Typo from "@/src/components/ui/Typo";
import { scale, verticalScale } from "@/src/utils/styling";
import * as Icons from "phosphor-react-native";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

export const DAY_WIDTH = scale(50);
export const ITEM_SPACING = scale(8);
export const ITEM_WIDTH = DAY_WIDTH + ITEM_SPACING;

export type WorkoutDayCardProps = {
  day: Date;
  isTodayCard: boolean;
  isSelected: boolean;
  isRestDay: boolean;
  hasWorkoutOnDay: boolean;
  isFuture: boolean;
  onPress: () => void;
};

const WorkoutDayCard = ({
  day,
  isTodayCard,
  isSelected,
  isRestDay,
  hasWorkoutOnDay,
  isFuture,
  onPress,
}: WorkoutDayCardProps) => {
  const { language } = useLanguage();
  const dayOfWeek = day.getDay() === 0 ? 6 : day.getDay() - 1;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.dayCard,
        isSelected && styles.dayCardSelected,
        isFuture && styles.dayCardFuture,
      ]}
      activeOpacity={isFuture ? 1 : 0.7}
      disabled={isFuture}
    >
      <Typo
        size={12}
        color={
          isFuture
            ? colors.neutral600
            : isSelected
              ? colors.black
              : colors.neutral400
        }
        fontWeight="500"
      >
        {WEEK_DAY_SHORT_NAMES[language][dayOfWeek]}
      </Typo>

      <View
        style={[
          styles.dayNumber,
          isTodayCard && !isSelected && styles.dayNumberToday,
        ]}
      >
        <Typo
          size={18}
          fontWeight={isSelected || isTodayCard ? "700" : "500"}
          color={
            isFuture
              ? colors.neutral600
              : isSelected
                ? colors.black
                : isTodayCard
                  ? colors.primary
                  : colors.white
          }
        >
          {day.getDate()}
        </Typo>
      </View>

      <View style={styles.indicators}>
        {hasWorkoutOnDay && (
          <View style={[styles.workoutDot, isSelected && styles.workoutDotSelected]} />
        )}
        {isRestDay && !hasWorkoutOnDay && (
          <Icons.Coffee
            size={12}
            color={isSelected ? colors.neutral700 : colors.neutral500}
            weight="fill"
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

export default React.memo(WorkoutDayCard);

const styles = StyleSheet.create({
  dayCard: {
    width: DAY_WIDTH,
    marginRight: ITEM_SPACING,
    alignItems: "center",
    paddingVertical: spacingY._10,
    borderRadius: radius._12,
    backgroundColor: colors.neutral800,
  },
  dayCardSelected: {
    backgroundColor: colors.primary,
  },
  dayCardFuture: {
    opacity: 0.4,
  },
  dayNumber: {
    marginVertical: spacingY._5,
  },
  dayNumberToday: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  indicators: {
    height: verticalScale(16),
    justifyContent: "center",
    alignItems: "center",
  },
  workoutDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
  },
  workoutDotSelected: {
    backgroundColor: colors.neutral900,
  },
});
