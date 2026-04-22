import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import SwipeableScreen from "@/src/components/layout/SwipeableScreen";
import Typo from "@/src/components/ui/Typo";
import useReduceMotion from "@/src/hooks/useReduceMotion";
import { auth } from "@/src/config/firebase";
import { useAuth } from "@/src/contexts/authContext";
import { useLanguage } from "@/src/contexts/languageContext";
import { getProfileImage } from "@/src/services/imageService";
import { accountOptionType } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import * as Icons from "phosphor-react-native";
import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

const Profile = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  const accountOptions: accountOptionType[] = [
    {
      id: "edit-profile",
      title: t("profile_edit_profile"),
      icon: <Icons.UserIcon size={24} color={colors.black} weight="fill" />,
      routeName: "/(modals)/profileModal",
      bgColor: colors.primary,
    },
    {
      id: "settings",
      title: t("profile_settings"),
      icon: <Icons.GearSixIcon size={24} color={colors.white} weight="fill" />,
      routeName: "/(modals)/settings",
      bgColor: colors.secondary,
    },
    {
      id: "privacy-policy",
      title: t("profile_privacy_policy"),
      icon: <Icons.LockIcon size={24} color={colors.white} weight="fill" />,
      routeName: "/(modals)/privacyPolicy",
      bgColor: colors.warning,
    },
    {
      id: "logout",
      title: t("profile_logout"),
      icon: <Icons.PowerIcon size={24} color={colors.white} weight="fill" />,
      // routeName: "/(modals)/profileModal",
      bgColor: colors.danger,
    },
  ];

    const handleLogout = async () => {
      await signOut(auth);
  };

  const showLogoutAlert = () => {
    Alert.alert(t("profile_logout_confirm_title"), t("profile_logout_confirm_message"), [
      {
        text: t("common_cancel"),
        onPress: () => {},
        style: "cancel",
      },
      {
        text: t("profile_logout"),
        onPress: () => handleLogout(), 
        style: "destructive"
      },
    ]);
  };

  const handlePress = (item: accountOptionType) => {
    if (item.id === "logout") {
      showLogoutAlert();
      return;
    }
    if (item.routeName) router.push(item.routeName);
  };

  return (
    <SwipeableScreen>
      <ScreenWrapper>
      <View style={styles.container}>
        <Header title={t("tab_profile")} style={{ marginVertical: spacingY._10 }} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* user info */}
          <View style={styles.userInfoOuter}>
            <View style={styles.userInfoShadow} />
            <View style={styles.userInfo}>
            {/* avatar */}
            <View>
              {/* user image */}
              <Image
                source={getProfileImage(user?.image)}
                style={styles.avatar}
                contentFit="cover"
                transition={100}
              />
            </View>
            {/* name and mail */}
            <View style={styles.nameContainer}>
              <Typo size={32} variant="heading" color={colors.textPrimary}>
                {user?.name}
              </Typo>
              <Typo size={15} color={colors.textMuted}>
                {user?.email}
              </Typo>
            </View>
          </View>
          </View>
          {/* account options */}
          <View style={styles.accountOptions}>
          {accountOptions.map((item, index) => {
            return (
              <Animated.View
                key={index.toString()}
                entering={
                  reduceMotion
                    ? undefined
                    : FadeInDown.delay(index * 50).springify().damping(14)
                }
                style={styles.listItem}
              >
                <View style={styles.listItemShadow} />
                <Pressable
                  style={({ pressed }) => [
                    styles.flexRow,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => handlePress(item)}
                >
                  <View
                    style={[styles.listIcon, { backgroundColor: item.bgColor }]}
                  >
                    {item.icon && item.icon}
                  </View>
                  <Typo
                    size={16}
                    style={{ flex: 1 }}
                    color={item.id === "logout" ? colors.danger : colors.textLight}
                    fontWeight={"600"}
                  >
                    {item.title}
                  </Typo>
                  <Icons.CaretRightIcon
                    size={verticalScale(20)}
                    weight="bold"
                    color={item.id === "logout" ? colors.danger : colors.textLight}
                  />
                </Pressable>
              </Animated.View>
            );
          })}
          </View>
        </ScrollView>
        </View>
    </ScreenWrapper>
    </SwipeableScreen>
  );
};

export default Profile;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  scrollContent: {
    paddingBottom: verticalScale(110),
  },
  userInfo: {
    alignItems: "center",
    gap: spacingY._15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius._17,
    paddingVertical: spacingY._20,
  },
  userInfoOuter: {
    position: "relative",
    marginTop: verticalScale(30),
    marginRight: 6,
    marginBottom: 6,
  },
  userInfoShadow: {
    position: "absolute",
    top: 1,
    left: 1,
    right: -1,
    bottom: -1,
    backgroundColor: colors.black,
    opacity: 0.25,
    borderRadius: radius._17,
  },
  avatarContainer: {
    position: "relative",
    alignSelf: "center",
  },
  avatar: {
    alignSelf: "center",
    backgroundColor: colors.surfaceMid,
    height: verticalScale(135),
    width: verticalScale(135),
    borderRadius: radius._20,
    borderWidth: 1,
    borderColor: colors.border,
    // overflow: "hidden",
    // position: "relative",
  },
  editIcon: {
    position: "absolute",
    bottom: 5,
    right: 8,
    borderRadius: 50,
    backgroundColor: colors.neutral100,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    padding: 5,
  },
  nameContainer: {
    gap: verticalScale(4),
    alignItems: "center",
  },
  listIcon: {
    height: verticalScale(44),
    width: verticalScale(44),
    backgroundColor: colors.neutral500,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius._10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listItem: {
    marginBottom: verticalScale(17) + 6,
    marginRight: 6,
    position: "relative",
  },
  listItemShadow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.black,
    opacity: 0.25,
    borderRadius: radius._15,
  },
  accountOptions: {
    marginTop: spacingY._25,
  },
  flexRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius._15,
    minHeight: 52,
    paddingHorizontal: spacingX._12,
    paddingVertical: spacingY._10,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.8,
  },
});
