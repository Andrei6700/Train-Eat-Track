import { colors, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useLanguage } from "@/src/contexts/languageContext";
import { getProfileImage } from "@/src/services/imageService";
import { updateUser } from "@/src/services/userService";
import { UserDataType } from "@/src/types/index";
import { scale, verticalScale } from "@/src/utils/styling";
import { Image } from "expo-image";
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const ProfileModal = () => {
  const { user, updateUserData } = useAuth();
  const { t } = useLanguage();
  const [userData, setUserData] = useState<UserDataType>({
    name: "",
    image: null,
  });

  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setUserData({
      name: user?.name || "",
      image: user?.image || null,
    });
  }, [user]);

  const onPickImage = async () => {
     let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
    //   allowsEditing: true,   
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      setUserData({ ...userData, image: result.assets[0] });
    }
  };

  const onSubmit = async () => {
    let { name } = userData;
    if (!name.trim()) {
      Alert.alert(t("profile_modal_alert_title"), t("common_validation_fill_all_fields"));
      return;
    }

    setLoading(true);
    const res = await updateUser(user?.uid as string, userData);
    setLoading(false);
    if (res.success) {
      // update user
      updateUserData(user?.uid as string);
      router.back();
    } else {
      Alert.alert(t("profile_modal_alert_title"), res.msg);
    }
  };
  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title={t("profile_modal_title")}
          leftIcon={<BackButton />}
          style={styles.headerMargin}
        />
        {/* form + footer inside KAV + ScrollView */}
        <KeyboardAvoidingView
          style={styles.flexOne}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            onScrollBeginDrag={Keyboard.dismiss}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.formContent}>
              <View style={styles.avatarContainer}>
                <Image
                  style={styles.avatar}
                  source={getProfileImage(userData.image)}
                  contentFit="cover"
                  transition={100}
                />
                <TouchableOpacity onPress={onPickImage} style={styles.editIcon}>
                  <Icons.PencilIcon
                    size={verticalScale(20)}
                    color={colors.neutral800}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.inputContainer}>
                <Typo color={colors.neutral200}>{t("profile_modal_name_label")}</Typo>
                <Input
                  placeholder={t("profile_modal_name_placeholder")}
                  value={userData.name}
                  onChangeText={(value) =>
                    setUserData({ ...userData, name: value })
                  }
                  containerStyle={styles.nameInput}
                  inputStyle={styles.nameInputText}
                />
              </View>
            </View>
            {/* footer pinned to bottom */}
            <View style={styles.footer}>
              <Button onPress={onSubmit} loading={loading} style={styles.flexOne}>
                <Typo color={colors.black} fontWeight={"700"}>
                  {t("profile_modal_update_button")}
                </Typo>
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ModalWrapper>
  );
};

export default ProfileModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  flexOne: {
    flex: 1,
  },
  headerMargin: {
    marginBottom: spacingY._10,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
  },
  formContent: {
    gap: spacingY._30,
    marginTop: spacingY._15,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: spacingX._20,
    gap: scale(12),
    paddingTop: spacingY._15,
    borderTopColor: colors.neutral700,
    marginBottom: spacingY._5,
    borderTopWidth: 1,
  },
  avatarContainer: {
    position: "relative",
    alignSelf: "center",
  },
  avatar: {
    alignSelf: "center",
    backgroundColor: colors.neutral300,
    height: verticalScale(135),
    width: verticalScale(135),
    borderRadius: 200,
    borderWidth: 2,
    borderColor: colors.neutral500,
    // overflow: "hidden",
    // position: "relative",
  },
  editIcon: {
    position: "absolute",
    bottom: spacingY._5,
    right: spacingY._7,
    borderRadius: 100,
    backgroundColor: colors.neutral100,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    padding: spacingY._7,
  },
  inputContainer: {
    gap: spacingY._10,
  },
  nameInput: {
    backgroundColor: colors.surfaceMid,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nameInputText: {
    color: colors.textLight,
  },
});

