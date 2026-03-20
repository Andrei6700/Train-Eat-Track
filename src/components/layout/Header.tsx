import { colors } from "@/constants/theme";
import { HeaderProps } from "@/src/types/index";
import React from "react";
import { StyleSheet, View } from "react-native";
import Typo from "../ui/Typo";

const Header = ({ title = "", leftIcon, rightIcon, style }: HeaderProps) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.sideSlot}>{leftIcon}</View>
      {title ? (
        <View style={styles.titleSlot}>
          <Typo
            size={32}
            variant="heading"
            color={colors.textPrimary}
            style={styles.titleText}
            textProps={{ numberOfLines: 1, adjustsFontSizeToFit: true }}
          >
            {title}
          </Typo>
        </View>
      ) : (
        <View style={styles.titleSlot} />
      )}
      <View style={styles.sideSlot}>{rightIcon}</View>
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
  sideSlot: {
    minWidth: 48,
    minHeight: 48,
    width: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  titleSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 8,
  },
  titleText: {
    textAlign: "center",
    width: "100%",
  },
});
