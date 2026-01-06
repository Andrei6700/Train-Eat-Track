import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/src/utils/styling";
import * as Icons from "phosphor-react-native";
import React from "react";
import { Linking, StyleSheet, TouchableOpacity, View } from "react-native";
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

// articles hardcodate 
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
  const handleArticlePress = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(600).delay(300).springify()}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.iconContainer}>
            <Icons.Flask size={22} color={"#8B5CF6"} weight="fill" />
          </View>
          <Typo size={18} fontWeight="700" color={colors.white}>
            Latest Science
          </Typo>
        </View>
      </View>

      {/* Articles */}
      <View style={styles.articlesList}>
        {articles.slice(0, 2).map((article, index) => (
          <TouchableOpacity
            key={index}
            style={styles.articleItem}
            onPress={() => handleArticlePress(article.url)}
            activeOpacity={0.7}
          >
            <View style={styles.articleContent}>
              <Typo size={15} fontWeight="600" color={colors.white} numberOfLines={2}>
                {article.title}
              </Typo>
              <Typo
                size={13}
                color={colors.neutral400}
                numberOfLines={2}
                style={{ marginTop: verticalScale(6), lineHeight: 18 }}
              >
                {article.summary}
              </Typo>
            </View>

            <View style={styles.arrowIcon}>
              <Icons.ArrowRight size={18} color={colors.primary} weight="bold" />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Icons.Database size={14} color={colors.neutral500} weight="fill" />
        <Typo size={11} color={colors.neutral500}>
          PubMed • National Library of Medicine
        </Typo>
      </View>
    </Animated.View>
  );
});

export default LatestScienceCard;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._20,
    padding: spacingX._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
    marginBottom: spacingY._25,
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
    backgroundColor: "rgba(139, 92, 246, 0.15)",
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
    backgroundColor: colors.neutral900,
    padding: spacingX._15,
    borderRadius: radius._15,
  },
  articleContent: {
    flex: 1,
  },
  arrowIcon: {
    width: verticalScale(32),
    height: verticalScale(32),
    backgroundColor: "rgba(163, 230, 53, 0.15)",
    borderRadius: radius._10,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
    paddingTop: spacingY._12,
    borderTopWidth: 1,
    borderTopColor: colors.neutral700,
  },
});