import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import useReduceMotion from "@/src/hooks/useReduceMotion";
import { useLanguage } from "@/src/contexts/languageContext";
import { verticalScale } from "@/src/utils/styling";
import { ArrowRight, Database, Flask } from "phosphor-react-native";
import React from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Typo from "./Typo";

type Article = {
  title: string;
  summary: string;
  url: string;
  date?: string;
};

type LatestScienceCardProps = {
  articles?: Article[];
};

const DEFAULT_ARTICLES: Article[] = [
  {
    title: "High-Protein Diets and Muscle Recovery",
    summary: "Studies show 1.6-2.2g/kg optimal for muscle growth and recovery.",
    url: "https://pubmed.ncbi.nlm.nih.gov/28698222/",
    date: "2024",
  },
  {
    title: "Progressive Overload in Strength Training",
    summary: "Research confirms gradual increases lead to better long-term gains.",
    url: "https://pubmed.ncbi.nlm.nih.gov/28834797/",
    date: "2024",
  },
];

const LatestScienceCard = React.memo(({ articles = DEFAULT_ARTICLES }: LatestScienceCardProps) => {
  const { t } = useLanguage();
  const reduceMotion = useReduceMotion();

  const handleArticlePress = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.duration(600).delay(300).springify()
      }
      style={styles.cardOuter}
    >
      <View style={styles.cardShadow} />
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.iconContainer}>
              <Flask size={22} color={colors.black} weight="fill" />
            </View>
            <Typo size={20} variant="heading">
              {t("home_latest_science")}
            </Typo>
          </View>
        </View>

        <View style={styles.articlesList}>
          {articles.slice(0, 2).map((article) => (
            <Pressable
              key={article.url}
              style={({ pressed }) => [styles.articleItem, pressed && styles.pressed]}
              onPress={() => handleArticlePress(article.url)}
            >
              <View style={styles.articleContent}>
                <Typo size={15} fontWeight="600" color={colors.textPrimary} numberOfLines={2}>
                  {article.title}
                </Typo>
                <Typo size={13} color={colors.textMuted} numberOfLines={2} style={styles.articleSummary}>
                  {article.summary}
                </Typo>
              </View>

              <View style={styles.arrowIcon}>
                <ArrowRight size={18} color={colors.primary} weight="bold" />
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.footer}>
          <Database size={14} color={colors.textMuted} weight="fill" />
          <Typo size={11} color={colors.textMuted}>
            PubMed - National Library of Medicine
          </Typo>
        </View>
      </View>
    </Animated.View>
  );
});

LatestScienceCard.displayName = "LatestScienceCard";

export default LatestScienceCard;

const styles = StyleSheet.create({
  cardOuter: {
    position: "relative",
    marginBottom: spacingY._25 + 6,
    marginRight: 6,
  },
  cardShadow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.black,
    opacity: 0.25,
    borderRadius: radius._20,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius._20,
    padding: spacingX._20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    marginBottom: spacingY._15,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
  },
  iconContainer: {
    width: verticalScale(40),
    height: verticalScale(40),
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius._12,
    alignItems: "center",
    justifyContent: "center",
  },
  articlesList: {
    gap: spacingY._12,
    marginBottom: spacingY._15,
  },
  articleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    backgroundColor: colors.surfaceRaised,
    padding: spacingX._15,
    borderRadius: radius._15,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.85,
  },
  articleContent: {
    flex: 1,
  },
  articleSummary: {
    marginTop: verticalScale(6),
    lineHeight: 18,
  },
  arrowIcon: {
    width: verticalScale(32),
    height: verticalScale(32),
    backgroundColor: colors.surface,
    borderRadius: radius._10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
    paddingTop: spacingY._12,
    borderTopWidth: 2,
    borderTopColor: colors.black,
  },
});

