import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Typo from "@/src/components/ui/Typo";
import { verticalScale } from "@/src/utils/styling";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

type PolicySection = {
  title: string;
  paragraphs: string[];
};

const LAST_UPDATED = "March 6, 2026";

const POLICY_SECTIONS: PolicySection[] = [
  {
    title: "1. Data We Collect",
    paragraphs: [
      "We collect information you provide directly, such as name, email, profile image, workouts, nutrition logs, water intake, and training plan details.",
      "We may also collect technical information needed to run the app, such as device type, app version, and basic diagnostics.",
    ],
  },
  {
    title: "2. Why We Use Your Data",
    paragraphs: [
      "We use your data to create your account, save your progress, personalize the app experience, and provide core features.",
      "We may use limited aggregated data to improve app performance, reliability, and product quality.",
    ],
  },
  {
    title: "3. Storage and Security",
    paragraphs: [
      "Your data is stored using cloud services (including Firebase infrastructure) and protected with reasonable technical and organizational safeguards.",
      "No method of storage or transmission is 100 percent secure, but we continuously work to protect your information.",
    ],
  },
  {
    title: "4. Data Sharing",
    paragraphs: [
      "We do not sell your personal data.",
      "Data may be processed by trusted service providers only when needed to operate the app (for example, authentication, hosting, and synchronization).",
    ],
  },
  {
    title: "5. Your Rights and Choices",
    paragraphs: [
      "You can review and update your profile information inside the app.",
      "You can request data access, correction, export, or deletion, subject to legal requirements in your jurisdiction.",
      "If you are in the European Union, you may have additional rights under GDPR.",
    ],
  },
  {
    title: "6. Data Retention",
    paragraphs: [
      "We retain account and activity data while your account is active or as needed to provide services.",
      "If you request account deletion, we will delete or anonymize your data unless we are legally required to retain some records.",
    ],
  },
  {
    title: "7. Children Privacy",
    paragraphs: [
      "This app is not intended for children under 16 years old.",
      "We do not knowingly collect personal data from children under 16.",
    ],
  },
  {
    title: "8. Changes to This Policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time.",
      "When changes are made, we update the Last Updated date shown on this page.",
    ],
  },
  {
    title: "9. Contact",
    paragraphs: [
      "For privacy-related questions, contact the app owner or support channel listed in your project documentation.",
    ],
  },
];

const PrivacyPolicy = () => {
  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <BackButton iconSize={28} />
          <Typo size={24} fontWeight="800" style={styles.headerTitle}>
            Privacy Policy
          </Typo>
          <Typo size={13} color={colors.neutral400} style={styles.lastUpdated}>
            Last updated: {LAST_UPDATED}
          </Typo>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.introCard}>
            <Typo size={14} color={colors.neutral300} style={styles.bodyText}>
              This policy explains what data Train-Eat-Track collects, how it is
              used, and what control you have over your information.
            </Typo>
          </View>

          {POLICY_SECTIONS.map((section) => (
            <View key={section.title} style={styles.sectionCard}>
              <Typo size={16} fontWeight="700" style={styles.sectionTitle}>
                {section.title}
              </Typo>
              {section.paragraphs.map((paragraph) => (
                <Typo key={paragraph} size={14} color={colors.neutral300} style={styles.bodyText}>
                  - {paragraph}
                </Typo>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
};

export default PrivacyPolicy;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    paddingHorizontal: spacingX._20,
    paddingTop: spacingY._10,
    paddingBottom: spacingY._15,
    gap: spacingY._10,
  },
  headerTitle: {
    marginTop: spacingY._10,
  },
  lastUpdated: {
    marginTop: spacingY._2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacingX._20,
    paddingBottom: spacingY._30,
    gap: spacingY._12,
  },
  introCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._15,
  },
  sectionCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._15,
    gap: spacingY._7,
  },
  sectionTitle: {
    marginBottom: spacingY._5,
  },
  bodyText: {
    lineHeight: verticalScale(20),
  },
});
