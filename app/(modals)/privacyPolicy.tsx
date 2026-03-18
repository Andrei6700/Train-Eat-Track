import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Typo from "@/src/components/ui/Typo";
import { useLanguage } from "@/src/contexts/languageContext";
import type { AppLanguage } from "@/src/i18n/translations";
import { verticalScale } from "@/src/utils/styling";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

type PolicySection = {
  title: string;
  paragraphs: string[];
};

type PolicyContent = {
  pageTitle: string;
  lastUpdatedLabel: string;
  lastUpdatedValue: string;
  intro: string;
  sections: PolicySection[];
};

const POLICY_CONTENT: Record<AppLanguage, PolicyContent> = {
  en: {
    pageTitle: "Privacy Policy",
    lastUpdatedLabel: "Last updated",
    lastUpdatedValue: "March 6, 2026",
    intro:
      "This policy explains what data Train-Eat-Track collects, how it is used, and what control you have over your information.",
    sections: [
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
    ],
  },
  ro: {
    pageTitle: "Politica de confidentialitate",
    lastUpdatedLabel: "Ultima actualizare",
    lastUpdatedValue: "6 martie 2026",
    intro:
      "Aceasta politica explica ce date colecteaza Train-Eat-Track, cum sunt folosite si ce control ai asupra informatiilor tale.",
    sections: [
      {
        title: "1. Datele pe care le colectam",
        paragraphs: [
          "Colectam informatiile pe care le oferi direct, precum nume, email, imagine de profil, antrenamente, jurnal de nutritie, aport de apa si detalii despre planul de antrenament.",
          "Putem colecta si informatii tehnice necesare functionarii aplicatiei, precum tipul dispozitivului, versiunea aplicatiei si diagnostice de baza.",
        ],
      },
      {
        title: "2. De ce folosim datele tale",
        paragraphs: [
          "Folosim datele pentru a crea contul, a salva progresul, a personaliza experienta in aplicatie si a oferi functionalitatile principale.",
          "Putem folosi date agregate, limitate, pentru a imbunatati performanta aplicatiei, fiabilitatea si calitatea produsului.",
        ],
      },
      {
        title: "3. Stocare si securitate",
        paragraphs: [
          "Datele tale sunt stocate folosind servicii cloud (inclusiv infrastructura Firebase) si sunt protejate prin masuri tehnice si organizationale rezonabile.",
          "Nicio metoda de stocare sau transmitere nu este 100 la suta sigura, dar lucram constant pentru a-ti proteja informatiile.",
        ],
      },
      {
        title: "4. Partajarea datelor",
        paragraphs: [
          "Nu vindem datele tale personale.",
          "Datele pot fi procesate de furnizori de servicii de incredere doar cand este necesar pentru functionarea aplicatiei (de exemplu, autentificare, gazduire si sincronizare).",
        ],
      },
      {
        title: "5. Drepturile si optiunile tale",
        paragraphs: [
          "Poti revizui si actualiza informatiile de profil din aplicatie.",
          "Poti solicita acces, corectare, export sau stergere a datelor, in functie de cerintele legale aplicabile in jurisdictia ta.",
          "Daca esti in Uniunea Europeana, poti avea drepturi suplimentare conform GDPR.",
        ],
      },
      {
        title: "6. Perioada de pastrare a datelor",
        paragraphs: [
          "Pastram datele de cont si activitate cat timp contul este activ sau cat este necesar pentru furnizarea serviciilor.",
          "Daca soliciti stergerea contului, vom sterge sau anonimiza datele, cu exceptia cazurilor in care legea ne obliga sa pastram anumite inregistrari.",
        ],
      },
      {
        title: "7. Confidentialitatea copiilor",
        paragraphs: [
          "Aplicatia nu este destinata copiilor sub 16 ani.",
          "Nu colectam intentionat date personale de la copii sub 16 ani.",
        ],
      },
      {
        title: "8. Modificari ale acestei politici",
        paragraphs: [
          "Putem actualiza aceasta Politica de confidentialitate periodic.",
          "Cand apar modificari, actualizam data de ultima actualizare afisata pe aceasta pagina.",
        ],
      },
      {
        title: "9. Contact",
        paragraphs: [
          "Pentru intrebari legate de confidentialitate, contacteaza proprietarul aplicatiei sau canalul de suport mentionat in documentatia proiectului.",
        ],
      },
    ],
  },
};

const PrivacyPolicy = () => {
  const { language } = useLanguage();
  const content = POLICY_CONTENT[language];

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <BackButton iconSize={28} />
          <Typo size={24} fontWeight="800" style={styles.headerTitle}>
            {content.pageTitle}
          </Typo>
          <Typo size={13} color={colors.neutral400} style={styles.lastUpdated}>
            {content.lastUpdatedLabel}: {content.lastUpdatedValue}
          </Typo>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.introCard}>
            <Typo size={14} color={colors.neutral300} style={styles.bodyText}>
              {content.intro}
            </Typo>
          </View>

          {content.sections.map((section, sectionIndex) => (
            <View key={`${section.title}-${sectionIndex}`} style={styles.sectionCard}>
              <Typo size={16} fontWeight="700" style={styles.sectionTitle}>
                {section.title}
              </Typo>
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <Typo
                  key={`${section.title}-${paragraphIndex}`}
                  size={14}
                  color={colors.neutral300}
                  style={styles.bodyText}
                >
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
    marginTop: spacingY._5,
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
