import { colors, radius, spacingX, spacingY } from "@/constants/theme";
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

const Register = () => {
  const emailRef = useRef("");
  const passwordRef = useRef("");
  const nameRef = useRef("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const t = (key: string) => translateText("en", key);

  const handleSubmit = async () => {
    if (!emailRef.current || !passwordRef.current || !nameRef.current) {
      Alert.alert(t("auth_register_alert_title"), t("common_validation_fill_all_fields"));
      return;
    }
    setIsLoading(true);
    const res = await registerUser(
      emailRef.current,
      passwordRef.current,
      nameRef.current
    );
    setIsLoading(false);
    if (__DEV__) {
      console.log('register result', res);
    }
    if (!res.success) {
      Alert.alert(t("auth_register_alert_title"), res.msg);
    }
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <ScreenWrapper>
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
            <BackButton iconSize={28} />

            <View style={styles.headingGroup}>
              <Typo size={40} variant="heading" color={colors.textPrimary}>
                {t("auth_register_heading_line1")}
              </Typo>
              <Typo size={40} variant="heading" color={colors.textPrimary}>
                {t("auth_register_heading_line2")}
              </Typo>
            </View>

            <View style={styles.form}>
              <Typo size={16} color={colors.textMuted}>
                {t("auth_register_subtitle")}
              </Typo>
              <Input
                placeholder={t("auth_placeholder_name")}
                onChangeText={(value) => (nameRef.current = value)}
                icon={
                  <Icons.User
                    size={verticalScale(26)}
                    color={colors.neutral400}
                    weight="fill"
                  />
                }
              />
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
              <View style={styles.passwordContainer}>
                <Input
                  placeholder={t("auth_placeholder_password")}
                  onChangeText={(value) => (passwordRef.current = value)}
                  secureTextEntry={!isPasswordVisible}
                  icon={
                    <Icons.Lock
                      size={verticalScale(26)}
                      color={colors.neutral400}
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
                      color={colors.neutral400}
                      weight="fill"
                    />
                  ) : (
                    <Icons.EyeSlash
                      size={verticalScale(24)}
                      color={colors.neutral400}
                      weight="fill"
                    />
                  )}
                </Pressable>
              </View>

              <View style={styles.buttonOuter}>
                <View style={styles.buttonShadow} />
                <Button loading={isLoading} onPress={handleSubmit}>
                  <Typo fontWeight={"700"} color={colors.black} size={21}>
                    {t("auth_register_button")}
                  </Typo>
                </Button>
              </View>
            </View>
            <View style={styles.footer}>
              <Typo size={15} color={colors.textMuted}>{t("auth_register_have_account")}</Typo>
              <Pressable onPress={() => router.push("/(auth)/login")}>
                <Typo size={15} fontWeight={"700"} color={colors.primary}>
                  {t("auth_register_login")}
                </Typo>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
};

export default Register;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
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
