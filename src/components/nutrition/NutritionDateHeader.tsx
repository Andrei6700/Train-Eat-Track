import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useLanguage } from "@/src/contexts/languageContext";
import Typo from "@/src/components/ui/Typo";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Icons from "phosphor-react-native";

type NutritionDateHeaderProps = {
  dateLabel: string;
  onOpenCalendarLog: () => void;
  onOpenSettings: () => void;
};

const NutritionDateHeader = ({
  dateLabel,
  onOpenCalendarLog,
  onOpenSettings,
}: NutritionDateHeaderProps) => {
  const { t } = useLanguage();

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.dateHeader}>
      <View style={styles.dateHeaderContent}>
        <Typo size={24} fontWeight="700">
          {dateLabel}
        </Typo>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onOpenCalendarLog}
            accessibilityRole="button"
            accessibilityLabel={t("nutrition_open_calendar_log_a11y")}
          >
            <Icons.CalendarBlank size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenSettings}>
            <Icons.Gear size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

export default React.memo(NutritionDateHeader);

const styles = StyleSheet.create({
  dateHeader: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    marginVertical: spacingY._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  dateHeaderContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._15,
  },
});
