import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Typo from "@/src/components/ui/Typo";
import { useLanguage } from "@/src/contexts/languageContext";
import useReduceMotion from "@/src/hooks/useReduceMotion";
import * as Icons from "phosphor-react-native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

type NutritionDateHeaderProps = {
  dateLabel: string;
  onOpenCalendarLog: () => void;
  onOpenSettings: () => void;
  onOpenMaintenance: () => void;
};

const NutritionDateHeader = ({
  dateLabel,
  onOpenCalendarLog,
  onOpenSettings,
  onOpenMaintenance,
}: NutritionDateHeaderProps) => {
  const { t } = useLanguage();
  const reduceMotion = useReduceMotion();

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(400)}
      style={styles.dateHeaderOuter}
    >
      <View style={styles.dateHeaderShadow} />
      <View style={styles.dateHeader}>
        <View style={styles.dateHeaderContent}>
          <Typo size={32} variant="heading">
            {dateLabel}
          </Typo>
          <View style={styles.actions}>
            <Pressable
              onPress={onOpenMaintenance}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Maintenance tracker"
            >
              <Icons.Scales size={24} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={onOpenCalendarLog}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t("nutrition_open_calendar_log_a11y")}
            >
              <Icons.CalendarBlank size={24} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={onOpenSettings}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t("profile_settings")}
            >
              <Icons.Gear size={24} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

export default React.memo(NutritionDateHeader);

const styles = StyleSheet.create({
  dateHeaderOuter: {
    position: "relative",
    marginVertical: spacingY._15,
    marginRight: 6,
  },
  dateHeaderShadow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.black,
    opacity: 0.25,
    borderRadius: radius._17,
  },
  dateHeader: {
    backgroundColor: colors.surface,
    borderRadius: radius._17,
    padding: spacingX._20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateHeaderContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
