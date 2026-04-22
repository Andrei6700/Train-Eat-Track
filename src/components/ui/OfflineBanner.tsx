import { colors, spacingX, spacingY } from "@/constants/theme";
import { useLanguage } from "@/src/contexts/languageContext";
import { useNetwork } from "@/src/contexts/networkContext";
import useReduceMotion from "@/src/hooks/useReduceMotion";
import { CloudSlash } from "phosphor-react-native";
import React from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import Typo from "./Typo";

const OfflineBanner = () => {
  const { isConnected } = useNetwork();
  const { t } = useLanguage();
  const reduceMotion = useReduceMotion();

  if (isConnected) return null;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInUp.duration(300)}
      exiting={reduceMotion ? undefined : FadeOutUp.duration(300)}
      style={styles.container}
    >
      <CloudSlash size={18} color={colors.white} weight="fill" />
      <Typo size={13} fontWeight="600" color={colors.white}>
        {t("offline_banner_message")}
      </Typo>
    </Animated.View>
  );
};

export default OfflineBanner;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._7,
    backgroundColor: colors.danger,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._15,
  },
});
