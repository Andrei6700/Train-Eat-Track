import { colors, spacingY } from "@/constants/theme";
import { useLanguage } from "@/src/contexts/languageContext";
import { verticalScale } from "@/src/utils/styling";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Icons from "phosphor-react-native";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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
    Platform.OS === "ios" ? verticalScale(85) : verticalScale(70) + androidBottomInset;
  const tabbarPaddingBottom =
    Platform.OS === "ios"
      ? spacingY._15
      : Math.max(spacingY._10, androidBottomInset);
  const tabbarIcons: any = {
    index: (isFocused: boolean) => (
      <Icons.HouseIcon
        size={verticalScale(28)}
        weight={isFocused ? "fill" : "regular"}
        color={isFocused ? colors.primary : colors.neutral400}
      />
    ),
    statistics: (isFocused: boolean) => (
      <Icons.ChartBarIcon
        size={verticalScale(28)}
        weight={isFocused ? "fill" : "regular"}
        color={isFocused ? colors.primary : colors.neutral400}
      />
    ),
    workout: (isFocused: boolean) => (
      <Icons.BarbellIcon
        size={verticalScale(28)}
        weight={isFocused ? "fill" : "regular"}
        color={isFocused ? colors.primary : colors.neutral400}
      />
    ),
    history: (isFocused: boolean) => (
      <Icons.ClockUserIcon
        size={verticalScale(28)}
        weight={isFocused ? "fill" : "regular"}
        color={isFocused ? colors.primary : colors.neutral400}
      />
    ),
    nutrition: (isFocused: boolean) => (
      <Icons.ForkKnifeIcon
        size={verticalScale(28)}
        weight={isFocused ? "fill" : "regular"}
        color={isFocused ? colors.primary : colors.neutral400}
      />
    ),
    profile: (isFocused: boolean) => (
      <Icons.UserIcon
        size={verticalScale(28)}
        weight={isFocused ? "fill" : "regular"}
        color={isFocused ? colors.primary : colors.neutral400}
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

        return (
          <TouchableOpacity
            key={route.name}
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabbarItem}
          >
            {tabbarIcons[route.name] && tabbarIcons[route.name](isFocused)}
            <Text
              numberOfLines={1}
              ellipsizeMode="clip"
              style={[
                styles.tabLabel,
                { color: isFocused ? colors.primary : colors.neutral400 },
              ]}
            >
              {tabbarLabels[route.name]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabbar: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: colors.black,
    justifyContent: "space-around",
    alignItems: "center",
    borderTopColor: colors.neutral700,
    borderTopWidth: 1,
  },
  tabbarItem: {
    justifyContent: "flex-end",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 13,
    marginTop: 4,
    fontWeight: "500",
    textAlign: "center",
    width: "100%",
  },
});
