import { colors, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import Button from "@/src/components/ui/Button";
import Typo from "@/src/components/ui/Typo";
import { translateText } from "@/src/i18n/translations";
import { verticalScale } from "@/src/utils/styling";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

const AUTH_COLORS = {
  background: "#FBFBF9",
  text: "#1C293C",
  muted: "#475569",
  accent: "#FDC800",
};

const Welcome = () => {
  const router = useRouter();
  const t = (key: string) => translateText("en", key);
  return (
    <ScreenWrapper
      style={{ backgroundColor: AUTH_COLORS.background }}
      statusBarStyle="dark-content"
      statusBarBackgroundColor={AUTH_COLORS.background}
    >
      <View style={styles.container}>
        <View>
          <TouchableOpacity onPress={()=>router.push('/(auth)/login')}
          style={styles.loginButton}>
            <Typo fontWeight={"600"} color={AUTH_COLORS.text}>
              {t("auth_welcome_sign_in")}
            </Typo>
          </TouchableOpacity>

          <Animated.Image
            entering={FadeIn.duration(1000)}
            source={require("@/assets/images/welcome.png")}
            style={styles.welcomeImage}
            resizeMode="contain"
          />
        </View>

        {/* footer */}
        <View style={styles.footer}>
          <Animated.View
            entering={FadeInDown.duration(1000).springify().damping(12)}
            style={{ alignItems: "center" }}
          >
            <Typo size={30} fontWeight={"800"} color={AUTH_COLORS.text}>
              {t("auth_welcome_title_line1")}
            </Typo>
            <Typo size={30} fontWeight={"800"} color={AUTH_COLORS.text}>
              {t("auth_welcome_title_line2")}
            </Typo>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(1000).delay(100).springify().damping(12)}
            style={{ alignItems: "center",gap: 2 }}>
            <Typo size={17} color={AUTH_COLORS.muted}>
              {t("auth_welcome_subtitle_line1")}
            </Typo>
            <Typo size={17} color={AUTH_COLORS.muted}>
              {t("auth_welcome_subtitle_line2")}
            </Typo>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(1000).delay(200).springify().damping(12)}
            style={styles.buttonContainer}>
            <Button
              onPress={()=>router.push('/(auth)/register')}
              buttonStyle={{ backgroundColor: AUTH_COLORS.accent }}
            >
              <Typo size={22} color={colors.black} fontWeight={"800"}>
                {t("auth_welcome_get_started")}
              </Typo>
            </Button>
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
  welcomeImage: {
    width: "100%",
    height: verticalScale(300),
    alignSelf: "center",
    marginTop: verticalScale(100),
  },
  loginButton: {
    alignSelf: "flex-end",
    marginRight: spacingX._20,
  },
  footer: {
    backgroundColor: AUTH_COLORS.background,
    alignItems: "center",
    paddingTop: verticalScale(30),
    paddingBottom: verticalScale(45),
    gap: spacingY._20,
    shadowColor: "white",
    shadowOffset: {
      width: 0,
      height: -10,
    },
    elevation: 10,
    shadowRadius: 25,
    shadowOpacity: 0.15,
  },
  buttonContainer: {
    width: "100%",
    paddingHorizontal: spacingX._25,
  },
});
