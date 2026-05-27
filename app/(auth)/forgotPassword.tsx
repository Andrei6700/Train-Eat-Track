import { colors, radius, spacingX, spacingY } from "@/constants/theme";
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
      <ScreenWrapper>
        <View style={styles.container}>
          <BackButton iconSize={28} />

          <View style={styles.successContainer}>
            <Icons.CheckCircle
              size={verticalScale(80)}
              color={colors.primary}
              weight="fill"
            />
            <Typo
              size={32}
              variant="heading"
              color={colors.textPrimary}
              style={{ textAlign: "center", marginTop: spacingY._20 }}
            >
              {t("auth_forgot_password_email_sent_title")}
            </Typo>
            <Typo
              size={16}
              color={colors.textMuted}
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
    <ScreenWrapper>
      <View style={styles.container}>
        <BackButton iconSize={28} />

        <View style={styles.headingGroup}>
          <Typo size={40} variant="heading" color={colors.textPrimary}>
            {t("auth_forgot_password_heading_line1")}
          </Typo>
          <Typo size={40} variant="heading" color={colors.textPrimary}>
            {t("auth_forgot_password_heading_line2")}
          </Typo>
        </View>

        <View style={styles.form}>
          <Typo size={16} color={colors.textMuted}>
            {t("auth_forgot_password_subtitle")}
          </Typo>
          <Input
            placeholder={t("auth_placeholder_email")}
            onChangeText={(value) => (emailRef.current = value)}
            icon={
              <Icons.At
                size={verticalScale(26)}
                color={colors.neutral400}
                weight="fill"
              />
            }
          />
          <View style={styles.buttonOuter}>
            <View style={styles.buttonShadow} />
            <Button loading={isLoading} onPress={handleSubmit}>
              <Typo fontWeight={"700"} color={colors.black} size={21}>
                {t("auth_forgot_password_button")}
              </Typo>
            </Button>
          </View>
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
  headingGroup: {
    gap: 5,
    marginTop: spacingY._20,
  },
  form: {
    gap: spacingY._20,
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
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacingX._20,
  },
});
