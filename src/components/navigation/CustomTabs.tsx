import { colors, spacingY } from "@/constants/theme";
import { useLanguage } from "@/src/contexts/languageContext";
import { verticalScale } from "@/src/utils/styling";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Icons from "phosphor-react-native";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CustomTabs({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === "android";
  const androidBottomInset = isAndroid ? insets.bottom : 0;
  const tabbarHeight =
    Platform.OS === "ios"
      ? verticalScale(82)
      : verticalScale(66) + androidBottomInset;
  const tabbarPaddingBottom =
    Platform.OS === "ios"
      ? spacingY._15
      : Math.max(spacingY._10, androidBottomInset);
  const tabbarIcons: any = {
    index: (isFocused: boolean) => (
      <Icons.HouseIcon
        size={verticalScale(28)}
        weight={isFocused ? "fill" : "bold"}
        color={isFocused ? colors.primary : colors.textMuted}
      />
    ),
    statistics: (isFocused: boolean) => (
      <Icons.ChartBarIcon
        size={verticalScale(28)}
        weight={isFocused ? "fill" : "bold"}
        color={isFocused ? colors.primary : colors.textMuted}
      />
    ),
    workout: (isFocused: boolean) => (
      <Icons.BarbellIcon
        size={verticalScale(28)}
        weight={isFocused ? "fill" : "bold"}
        color={isFocused ? colors.primary : colors.textMuted}
      />
    ),
    history: (isFocused: boolean) => (
      <Icons.ClockUserIcon
        size={verticalScale(28)}
        weight={isFocused ? "fill" : "bold"}
        color={isFocused ? colors.primary : colors.textMuted}
      />
    ),
    nutrition: (isFocused: boolean) => (
      <Icons.ForkKnifeIcon
        size={verticalScale(28)}
        weight={isFocused ? "fill" : "bold"}
        color={isFocused ? colors.primary : colors.textMuted}
      />
    ),
    profile: (isFocused: boolean) => (
      <Icons.UserIcon
        size={verticalScale(28)}
        weight={isFocused ? "fill" : "bold"}
        color={isFocused ? colors.primary : colors.textMuted}
      />
    ),
  };

  const tabbarLabels: any = {
    index: t("tab_home"),
    statistics: t("tab_statistics"),
    workout: t("tab_workout"),
    history: t("tab_history"),
    nutrition: t("tab_nutrition"),
    profile: t("tab_profile"),
  };

  return (
    <View
      style={[
        styles.tabbar,
        {
          height: tabbarHeight,
          paddingBottom: tabbarPaddingBottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: "tabLongPress",
            target: route.key,
          });
        };

        const routeLabel = tabbarLabels[route.name] || route.name;

        return (
          <Pressable
            key={route.name}
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityRole="button"
            accessibilityLabel={routeLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            style={({ pressed }) => [
              styles.tabbarItem,
              pressed && styles.pressedTab,
            ]}
          >
            <View style={styles.iconWrap}>
              {tabbarIcons[route.name] && tabbarIcons[route.name](isFocused)}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabbar: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: colors.tabBar,
    justifyContent: "space-around",
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  tabbarItem: {
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
    minHeight: 48,
    minWidth: 0,
    gap: 6,
  },
  pressedTab: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  iconWrap: {
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
