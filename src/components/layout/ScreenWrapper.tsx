import { colors } from "@/constants/theme";
import { ScreenWrapperProps } from '@/src/types/index';
import React, { useMemo } from "react";
import { Dimensions, Platform, StatusBar, StyleSheet, View } from "react-native";

const { height } = Dimensions.get("window");

const ScreenWrapper = React.memo(({ style, children }: ScreenWrapperProps) => {
  const paddingTop = useMemo(
    () => (Platform.OS === "ios" ? height * 0.06 : 20),
    []
  );

  const containerStyle = useMemo(
    () => [
      styles.container,
      { paddingTop },
      style,
    ],
    [paddingTop, style]
  );

  return (
    <View style={containerStyle}>
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