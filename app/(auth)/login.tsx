import { colors, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { translateText } from "@/src/i18n/translations";
import { verticalScale } from "@/src/utils/styling";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

const AUTH_COLORS = {
  background: "#FBFBF9",
  text: "#1C293C",
  muted: "#475569",
  icon: "#334155",
  accent: "#FDC800",
};

const Login = () => {
  const emailRef = useRef("");
  const passwordRef = useRef("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const router = useRouter();
  const { login: loginUser } = useAuth();
  const t = (key: string) => translateText("en", key);

  const handleSubmit = async () => {
    if (!emailRef.current || !passwordRef.current) {
      Alert.alert(
        t("auth_login_alert_title"),
        t("common_validation_fill_all_fields"),
      );
      return;
    }
    setIsLoading(true);
    const res = await loginUser(emailRef.current, passwordRef.current);
    setIsLoading(false);
    if (!res.success) {
      Alert.alert(t("auth_login_alert_title"), res.msg);
    }
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <ScreenWrapper
      style={styles.screenBackground}
      statusBarStyle="dark-content"
      statusBarBackgroundColor={AUTH_COLORS.background}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <BackButton
              iconSize={28}
              buttonStyle={styles.backButton}
            />

            <View style={styles.headingGroup}>
              <Typo size={30} fontWeight={"800"} color={AUTH_COLORS.text}>
                {t("auth_login_heading_line1")}
              </Typo>
              <Typo size={30} fontWeight={"800"} color={AUTH_COLORS.text}>
                {t("auth_login_heading_line2")}
              </Typo>
            </View>

            <View style={styles.form}>
              <Typo size={16} color={AUTH_COLORS.muted}>
                {t("auth_login_subtitle")}
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
              <View style={styles.passwordContainer}>
                <Input
                  placeholder={t("auth_placeholder_password")}
                  onChangeText={(value) => (passwordRef.current = value)}
                  secureTextEntry={!isPasswordVisible}
                  containerStyle={styles.authInput}
                  inputStyle={styles.authInputText}
                  icon={
                    <Icons.Lock
                      size={verticalScale(26)}
                      color={AUTH_COLORS.icon}
                      weight="fill"
                    />
                  }
                />
                <Pressable
                  onPress={togglePasswordVisibility}
                  style={styles.eyeButton}
                >
                  {isPasswordVisible ? (
                    <Icons.Eye
                      size={verticalScale(24)}
                      color={AUTH_COLORS.icon}
                      weight="fill"
                    />
                  ) : (
                    <Icons.EyeSlash
                      size={verticalScale(24)}
                      color={AUTH_COLORS.icon}
                      weight="fill"
                    />
                  )}
                </Pressable>
              </View>
              <Pressable onPress={() => router.navigate("/(auth)/forgotPassword")}>
                <Typo
                  size={14}
                  color={AUTH_COLORS.text}
                  fontWeight={"600"}
                  style={styles.forgotPasswordLink}
                >
                  {t("auth_login_forgot_password")}
                </Typo>
              </Pressable>
              <Button
                loading={isLoading}
                onPress={handleSubmit}
                buttonStyle={styles.loginButton}
              >
                <Typo fontWeight={"700"} color={colors.black} size={21}>
                  {t("auth_login_button")}
                </Typo>
              </Button>
            </View>
            <View style={styles.footer}>
              <Typo size={15} color={AUTH_COLORS.text}>
                {t("auth_login_no_account")}
              </Typo>
              <Pressable onPress={() => router.navigate("/(auth)/register")}>
                <Typo size={15} fontWeight={"700"} color={AUTH_COLORS.accent}>
                  {t("auth_login_sign_up")}
                </Typo>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
};

export default Login;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screenBackground: {
    backgroundColor: AUTH_COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    gap: spacingY._30,
    paddingHorizontal: spacingX._20,
  },
  backButton: {
    backgroundColor: AUTH_COLORS.accent,
  },
  headingGroup: {
    gap: 5,
    marginTop: spacingY._20,
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
  forgotPasswordLink: {
    alignSelf: "flex-end",
  },
  loginButton: {
    backgroundColor: AUTH_COLORS.accent,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    alignItems: "center",
    marginTop: "auto",
    paddingBottom: spacingY._20,
  },
  passwordContainer: {
    position: "relative",
    justifyContent: "center",
  },
  eyeButton: {
    position: "absolute",
    right: spacingX._15,
    padding: 5,
    alignSelf: "center",
  },
});
