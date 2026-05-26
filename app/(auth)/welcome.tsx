import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import Button from "@/src/components/ui/Button";
import Typo from "@/src/components/ui/Typo";
import { translateText } from "@/src/i18n/translations";
import { verticalScale } from "@/src/utils/styling";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

const Welcome = () => {
  const router = useRouter();
  const t = (key: string) => translateText("en", key);
  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View>
          <Pressable
            onPress={() => router.push("/(auth)/login")}
            style={({ pressed }) => [
              styles.loginButton,
              pressed && styles.loginButtonPressed,
            ]}
          >
            <Typo fontWeight={"600"} color={colors.primary}>
              {t("auth_welcome_sign_in")}
            </Typo>
          </Pressable>

          <Animated.View 
            entering={FadeIn.duration(1000)}
            style={styles.imageContainer}
          >
            <Image
              source={require("@/assets/images/Logo.png")}
              style={styles.welcomeImage}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* footer */}
        <View style={styles.footer}>
          <Animated.View
            entering={FadeInDown.duration(1000).springify().damping(12)}
            style={{ alignItems: "center" }}
          >
            <Typo size={40} variant="heading" color={colors.textPrimary}>
              {t("auth_welcome_title_line1")}
            </Typo>
            <Typo size={40} variant="heading" color={colors.textPrimary}>
              {t("auth_welcome_title_line2")}
            </Typo>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(1000)
              .delay(100)
              .springify()
              .damping(12)}
            style={{ alignItems: "center", gap: 2 }}
          >
            <Typo size={17} color={colors.textMuted}>
              {t("auth_welcome_subtitle_line1")}
            </Typo>
            <Typo size={17} color={colors.textMuted}>
              {t("auth_welcome_subtitle_line2")}
            </Typo>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(1000)
              .delay(200)
              .springify()
              .damping(12)}
            style={styles.buttonContainer}
          >
            <View style={styles.buttonOuter}>
              <View style={styles.buttonShadow} />
              <Button onPress={() => router.push("/(auth)/register")}>
                <Typo size={22} color={colors.black} fontWeight={"800"}>
                  {t("auth_welcome_get_started")}
                </Typo>
              </Button>
            </View>
          </Animated.View>
        </View>
      </View>
    </ScreenWrapper>
  );
};

export default Welcome;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingTop: spacingY._7,
  },
  imageContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: verticalScale(40),
  },
  welcomeImage: {
    width: "85%",
    height: verticalScale(260),
    alignSelf: "center",
  },
  loginButton: {
    alignSelf: "flex-end",
    marginRight: spacingX._20,
    paddingVertical: spacingY._5,
    paddingHorizontal: spacingX._10,
  },
  loginButtonPressed: {
    opacity: 0.7,
  },
  footer: {
    alignItems: "center",
    paddingTop: verticalScale(30),
    paddingBottom: verticalScale(45),
    gap: spacingY._20,
  },
  buttonContainer: {
    width: "100%",
    paddingHorizontal: spacingX._25,
  },
  buttonOuter: {
    position: "relative",
    marginRight: 6,
    marginBottom: 6,
  },
  buttonShadow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.black,
    opacity: 0.25,
    borderRadius: radius._12,
  },
});
