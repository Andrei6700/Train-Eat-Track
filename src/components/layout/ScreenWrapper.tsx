import { colors } from "@/constants/theme";
import { ScreenWrapperProps } from "@/src/types/index";
import React from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ScreenWrapper = React.memo(({ style, children }: ScreenWrapperProps) => {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, 12);

  return (
    <View style={[styles.container, { paddingTop: topPadding }, style]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.neutral900} />
      {children}
    </View>
  );
});

ScreenWrapper.displayName = 'ScreenWrapper';

export default ScreenWrapper;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral900,
  },
});
