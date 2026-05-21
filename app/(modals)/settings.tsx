import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useLanguage } from "@/src/contexts/languageContext";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import { exportWorkoutPlanToExcel } from "@/src/services/workoutPlanExportService";
import { getUserWorkouts } from "@/src/services/workoutService";
import { verticalScale } from "@/src/utils/styling";
import * as Icons from "phosphor-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";

type SettingItemProps = {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightComponent?: React.ReactNode;
  showChevron?: boolean;
};

const SettingItem: React.FC<SettingItemProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  rightComponent,
  showChevron = true,
}) => {
  return (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingLeft}>
        <View style={styles.iconContainer}>{icon}</View>
        <View style={styles.textContainer}>
          <Typo size={16} fontWeight="600">
            {title}
          </Typo>
          {subtitle && (
            <Typo size={13} color={colors.textLighter} style={styles.subtitleMargin}>
              {subtitle}
            </Typo>
          )}
        </View>
      </View>
      <View style={styles.settingRight}>
        {rightComponent}
        {showChevron && onPress && (
          <Icons.CaretRight
            size={verticalScale(20)}
            color={colors.neutral400}
            weight="bold"
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

type SectionHeaderProps = {
  title: string;
};

const SectionHeader: React.FC<SectionHeaderProps> = ({ title }) => {
  return (
    <View style={styles.sectionHeader}>
      <Typo size={14} fontWeight="700" color={colors.textLighter}>
        {title.toUpperCase()}
      </Typo>
    </View>
  );
};

const Settings = () => {
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { workoutPlan } = useWorkoutPlan();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const selectedLanguage =
    language === "ro"
      ? t("settings_language_romanian")
      : t("settings_language_english");

  const handleLanguagePress = () => {
    const nextLanguage = language === "en" ? "ro" : "en";
    void setLanguage(nextLanguage);
  };

  const handleExportPlan = async () => {
    if (isExporting) return;

    if (!user?.uid) {
      Alert.alert(
        t("common_error"),
        t("settings_modal_error_logged_in_required"),
      );
      return;
    }

    setIsExporting(true);
    try {
      const workoutsResult = await getUserWorkouts(user.uid);
      if (!workoutsResult.success) {
        Alert.alert(
          t("common_error"),
          workoutsResult.msg || t("settings_modal_error_load_history"),
        );
        return;
      }

      const workoutsHistory = Array.isArray(workoutsResult.data)
        ? workoutsResult.data
        : [];

      if (workoutsHistory.length === 0) {
        Alert.alert(
          t("common_error"),
          t("settings_modal_error_no_workouts"),
        );
        return;
      }

      const exportResult = await exportWorkoutPlanToExcel({
        workoutPlan,
        workoutsHistory,
        userName: user.name || undefined,
        userEmail: user.email || undefined,
      });

      if (exportResult.success) {
        Alert.alert(t("common_success"), t("settings_modal_success_export"));
      } else {
        Alert.alert(
          t("common_error"),
          exportResult.msg || t("settings_modal_error_export"),
        );
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("settings_modal_error_export");
      Alert.alert(t("common_error"), message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleNotifications = () => {
    // TODO: Implement notifications settings navigation
    // router.push("/(modals)/notificationSettings");
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton iconSize={28} />
          <Typo size={24} fontWeight="800" style={styles.headerTitle}>
            {t("settings_modal_title")}
          </Typo>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Appearance Section */}
          <SectionHeader title={t("settings_modal_section_appearance")} />
          <View style={styles.section}>
            <SettingItem
              icon={
                <Icons.Moon
                  size={verticalScale(24)}
                  color={colors.primary}
                  weight="fill"
                />
              }
              title={t("settings_modal_dark_mode_title")}
              subtitle={t("settings_modal_dark_mode_subtitle")}
              showChevron={false}
              rightComponent={
                <Switch
                  value={isDarkMode}
                  onValueChange={setIsDarkMode}
                  trackColor={{
                    false: colors.neutral700,
                    true: colors.primary,
                  }}
                  thumbColor={colors.white}
                />
              }
            />
          </View>

          {/* Language & Region Section */}
          <SectionHeader title={t("settings_modal_section_language_region")} />
          <View style={styles.section}>
            <SettingItem
              icon={
                <Icons.Translate
                  size={verticalScale(24)}
                  color={colors.primary}
                  weight="fill"
                />
              }
              title={t("settings_modal_language_title")}
              subtitle={selectedLanguage}
              onPress={handleLanguagePress}
            />
          </View>

          {/* Data & Export Section */}
          <SectionHeader title={t("settings_modal_section_data_export")} />
          <View style={styles.section}>
            <SettingItem
              icon={
                <Icons.FileXls
                  size={verticalScale(24)}
                  color={colors.primary}
                  weight="fill"
                />
              }
              title={
                isExporting
                  ? t("settings_modal_exporting_title")
                  : t("settings_modal_export_title")
              }
              subtitle={
                isExporting
                  ? t("settings_modal_exporting_subtitle")
                  : t("settings_modal_export_subtitle")
              }
              onPress={isExporting ? undefined : handleExportPlan}
              showChevron={!isExporting}
              rightComponent={
                isExporting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : undefined
              }
            />
          </View>

          {/* Notifications Section */}
          <SectionHeader title={t("settings_modal_section_notifications")} />
          <View style={styles.section}>
            <SettingItem
              icon={
                <Icons.Bell
                  size={verticalScale(24)}
                  color={colors.primary}
                  weight="fill"
                />
              }
              title={t("settings_modal_push_notifications_title")}
              subtitle={t("settings_modal_push_notifications_subtitle")}
              showChevron={false}
              rightComponent={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{
                    false: colors.neutral700,
                    true: colors.primary,
                  }}
                  thumbColor={colors.white}
                />
              }
            />
            <SettingItem
              icon={
                <Icons.BellRinging
                  size={verticalScale(24)}
                  color={colors.primary}
                  weight="fill"
                />
              }
              title={t("settings_modal_notification_settings_title")}
              subtitle={t("settings_modal_notification_settings_subtitle")}
              onPress={handleNotifications}
            />
          </View>

          {/* App Version */}
          <View style={styles.versionContainer}>
            <Typo size={13} color={colors.neutral500}>
              {t("settings_modal_app_version")}
            </Typo>
          </View>
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
};

export default Settings;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    paddingHorizontal: spacingX._20,
    paddingTop: spacingY._10,
    paddingBottom: spacingY._15,
    gap: spacingY._15,
  },
  headerTitle: {
    marginTop: spacingY._10,
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: spacingX._20,
    paddingTop: spacingY._25,
    paddingBottom: spacingY._10,
  },
  section: {
    backgroundColor: colors.surfaceCard,
    marginHorizontal: spacingX._20,
    borderRadius: radius._15,
    overflow: "hidden",
    marginBottom: spacingY._10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacingY._15,
    paddingHorizontal: spacingX._15,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: verticalScale(45),
    height: verticalScale(45),
    borderRadius: radius._12,
    backgroundColor: colors.surfaceMid,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacingX._15,
  },
  textContainer: {
    flex: 1,
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  versionContainer: {
    alignItems: "center",
    paddingVertical: spacingY._30,
    marginBottom: spacingY._20,
  },
  subtitleMargin: {
    marginTop: 2,
  },
});

