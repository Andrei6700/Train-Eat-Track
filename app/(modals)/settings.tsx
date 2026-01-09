import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Typo from "@/src/components/ui/Typo";
import { verticalScale } from "@/src/utils/styling";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useState } from "react";
import {
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
            <Typo size={13} color={colors.textLighter} style={{ marginTop: 2 }}>
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
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("Română");

  const handleLanguagePress = () => {
    // UI only - toggle between languages
    setSelectedLanguage((prev) =>
      prev === "Română" ? "English" : "Română"
    );
  };

  const handleExportPlan = () => {
    // UI only - show action was pressed
    console.log("Export plan pressed");
  };

  const handleNotifications = () => {
    // UI only - navigate to notifications settings
    console.log("Notifications settings pressed");
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton iconSize={28} />
          <Typo size={24} fontWeight="800" style={styles.headerTitle}>
            Settings
          </Typo>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Appearance Section */}
          <SectionHeader title="Appearance" />
          <View style={styles.section}>
            <SettingItem
              icon={
                <Icons.Moon
                  size={verticalScale(24)}
                  color={colors.primary}
                  weight="fill"
                />
              }
              title="Dark Mode"
              subtitle="Toggle dark/light theme"
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
          <SectionHeader title="Language & Region" />
          <View style={styles.section}>
            <SettingItem
              icon={
                <Icons.Translate
                  size={verticalScale(24)}
                  color={colors.primary}
                  weight="fill"
                />
              }
              title="Language"
              subtitle={selectedLanguage}
              onPress={handleLanguagePress}
            />
          </View>

          {/* Data & Export Section */}
          <SectionHeader title="Data & Export" />
          <View style={styles.section}>
            <SettingItem
              icon={
                <Icons.FileXls
                  size={verticalScale(24)}
                  color={colors.primary}
                  weight="fill"
                />
              }
              title="Export Workout Plan"
              subtitle="Download as Excel file"
              onPress={handleExportPlan}
            />
          </View>

          {/* Notifications Section */}
          <SectionHeader title="Notifications" />
          <View style={styles.section}>
            <SettingItem
              icon={
                <Icons.Bell
                  size={verticalScale(24)}
                  color={colors.primary}
                  weight="fill"
                />
              }
              title="Push Notifications"
              subtitle="Workout reminders & updates"
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
              title="Notification Settings"
              subtitle="Customize alerts & reminders"
              onPress={handleNotifications}
            />
          </View>

          {/* App Version */}
          <View style={styles.versionContainer}>
            <Typo size={13} color={colors.neutral500}>
              App Version 1.0.0
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
    backgroundColor: colors.black,
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
    backgroundColor: colors.neutral900,
    marginHorizontal: spacingX._20,
    borderRadius: radius._15,
    overflow: "hidden",
    marginBottom: spacingY._10,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacingY._15,
    paddingHorizontal: spacingX._15,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.neutral800,
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
    backgroundColor: colors.neutral800,
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
});