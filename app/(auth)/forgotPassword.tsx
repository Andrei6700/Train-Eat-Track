import { colors, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { translateText } from "@/src/i18n/translations";
import { verticalScale } from "@/src/utils/styling";
import * as Icons from "phosphor-react-native";
import React, { useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

const AUTH_COLORS = {
  background: "#FBFBF9",
  text: "#1C293C",
  muted: "#475569",
  icon: "#334155",
  accent: "#FDC800",
};

const ForgotPassword = () => {
  const emailRef = useRef("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { forgotPassword } = useAuth();
  const t = (key: string) => translateText("en", key);

  const handleSubmit = async () => {
    if (!emailRef.current) {
      Alert.alert(
        t("auth_forgot_password_title"),
        t("auth_forgot_password_enter_email"),
      );
      return;
    }
    setIsLoading(true);
    const res = await forgotPassword(emailRef.current);
    setIsLoading(false);
    if (res.success) {
      setEmailSent(true);
    } else {
      Alert.alert(t("auth_forgot_password_title"), res.msg);
    }
  };

  if (emailSent) {
    return (
      <ScreenWrapper
        style={{ backgroundColor: AUTH_COLORS.background }}
        statusBarStyle="dark-content"
        statusBarBackgroundColor={AUTH_COLORS.background}
      >
        <View style={styles.container}>
          <BackButton
            iconSize={28}
            buttonStyle={{ backgroundColor: AUTH_COLORS.accent }}
          />

          <View style={styles.successContainer}>
            <Icons.CheckCircle
              size={verticalScale(80)}
              color={AUTH_COLORS.accent}
              weight="fill"
            />
            <Typo
              size={24}
              fontWeight={"800"}
              color={AUTH_COLORS.text}
              style={{ textAlign: "center", marginTop: spacingY._20 }}
            >
              {t("auth_forgot_password_email_sent_title")}
            </Typo>
            <Typo
              size={16}
              color={AUTH_COLORS.muted}
              style={{ textAlign: "center", marginTop: spacingY._10 }}
            >
              {t("auth_forgot_password_email_sent_subtitle")}
            </Typo>
          </View>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper
      style={{ backgroundColor: AUTH_COLORS.background }}
      statusBarStyle="dark-content"
      statusBarBackgroundColor={AUTH_COLORS.background}
    >
      <View style={styles.container}>
        <BackButton
          iconSize={28}
          buttonStyle={{ backgroundColor: AUTH_COLORS.accent }}
        />

        <View style={{ gap: 5, marginTop: spacingY._20 }}>
          <Typo size={30} fontWeight={"800"} color={AUTH_COLORS.text}>
            {t("auth_forgot_password_heading_line1")}
          </Typo>
          <Typo size={30} fontWeight={"800"} color={AUTH_COLORS.text}>
            {t("auth_forgot_password_heading_line2")}
          </Typo>
        </View>

        <View style={styles.form}>
          <Typo size={16} color={AUTH_COLORS.muted}>
            {t("auth_forgot_password_subtitle")}
          </Typo>
          <Input
            placeholder={t("auth_placeholder_email")}
            onChangeText={(value) => (emailRef.current = value)}
            containerStyle={styles.authInput}
            inputStyle={styles.authInputText}
            icon={
              <Icons.At
                size={verticalScale(26)}
                color={AUTH_COLORS.icon}
                weight="fill"
              />
            }
          />
          <Button
            loading={isLoading}
            onPress={handleSubmit}
            buttonStyle={{ backgroundColor: AUTH_COLORS.accent }}
          >
            <Typo fontWeight={"700"} color={colors.black} size={21}>
              {t("auth_forgot_password_button")}
            </Typo>
          </Button>
        </View>
      </View>
    </ScreenWrapper>
  );
};

export default ForgotPassword;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacingY._30,
    paddingHorizontal: spacingX._20,
  },
  form: {
    gap: spacingY._20,
  },
  authInput: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
  },
  authInputText: {
    color: AUTH_COLORS.text,
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacingX._20,
  },
});
