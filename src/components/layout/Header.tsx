import { colors } from "@/constants/theme";
import { HeaderProps } from "@/src/types/index";
import React from "react";
import { StyleSheet, View } from "react-native";
import Typo from "../ui/Typo";

const Header = ({ title = "", leftIcon, rightIcon, style }: HeaderProps) => {
  return (
    <View style={[styles.container, style]}>
      {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
      {title && (
        <Typo
          size={32}
          variant="heading"
          color={colors.textPrimary}
          style={{
            textAlign: "center",
            width: leftIcon || rightIcon ? "76%" : "100%",
          }}
        >
          {title}
        </Typo>
      )}
      {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
    </View>
  );
};

export default Header;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  leftIcon: {
    alignSelf: "flex-start",
    minWidth: 48,
    minHeight: 48,
    justifyContent: "center",
  },
  rightIcon: {
    alignSelf: "flex-start",
    minWidth: 48,
    minHeight: 48,
    justifyContent: "center",
  },
});
