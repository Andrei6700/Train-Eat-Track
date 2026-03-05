import { colors } from "@/constants/theme";
import { ScreenWrapperProps } from "@/src/types/index";
import React from "react";
import { Dimensions, Platform, StatusBar, StyleSheet, View } from "react-native";

const { height } = Dimensions.get("window");
const paddingTop = Platform.OS === "ios" ? height * 0.06 : 20;

const ScreenWrapper = React.memo(({ style, children }: ScreenWrapperProps) => {
  return (
    <View style={[styles.container, styles.containerPadding, style]}>
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
  containerPadding: {
    paddingTop,
  },
});
