import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/src/utils/styling";
import * as Icons from "phosphor-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Typo from "./Typo";

type AICoachCardProps = {
  tip: string;
  emoji: string;
  type?: "motivational" | "warning" | "suggestion" | "congratulation";
};

const AICoachCard = React.memo(
  ({ tip, emoji, type = "motivational" }: AICoachCardProps) => {
    const getGradientColors = () => {
      switch (type) {
        case "warning":
          return { primary: "#EF4444", secondary: "#DC2626" };
        case "congratulation":
          return { primary: colors.primary, secondary: "#84cc16" };
        case "suggestion":
          return { primary: "#3B82F6", secondary: "#2563EB" };
        default:
          return { primary: "#8B5CF6", secondary: "#7C3AED" };
      }
    };

    const gradientColors = getGradientColors();

    // Select icon based on type
    const getIcon = () => {
      switch (type) {
        case "warning":
          return <Icons.Warning size={24} color={gradientColors.primary} weight="fill" />;
        case "congratulation":
          return <Icons.Trophy size={24} color={gradientColors.primary} weight="fill" />;
        case "suggestion":
          return <Icons.Lightbulb size={24} color={gradientColors.primary} weight="fill" />;
        default:
          return <Icons.Sparkle size={24} color={gradientColors.primary} weight="fill" />;
      }
    };

    return (
      <Animated.View
        entering={FadeInDown.duration(600).delay(100).springify()}
        style={styles.container}
      >
        {/* Gradient Background Effect */}
        <View
          style={[
            styles.gradientBackground,
            {
              backgroundColor: gradientColors.primary,
              opacity: 0.08,
            },
          ]}
        />

        {/* Content */}
        <View style={styles.content}>
          {/* Icon + Title */}
          <View style={styles.header}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${gradientColors.primary}20` },
              ]}
            >
              {getIcon()}
            </View>

            <View style={styles.titleContainer}>
              <Typo size={18} fontWeight="700" color={colors.white}>
                AI Coach
              </Typo>
              <View style={styles.betaBadge}>
                <Typo size={9} fontWeight="700" color={colors.black}>
                  BETA
                </Typo>
              </View>
            </View>
          </View>

          {/* Tip Message */}
          <View style={styles.tipContainer}>
            <Typo size={15} color={colors.neutral200} style={styles.tipText}>
              {tip}
            </Typo>
          </View>
        </View>
      </Animated.View>
    );
  }
);

export default AICoachCard;

const styles = StyleSheet.create({
  container: {
    position: "relative",
    backgroundColor: colors.neutral800,
    borderRadius: radius._20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.neutral700,
    marginBottom: spacingY._20,
  },
  gradientBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius._20,
  },
  content: {
    padding: spacingX._20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._15,
    marginBottom: spacingY._15,
  },
  iconContainer: {
    width: verticalScale(60),
    height: verticalScale(60),
    borderRadius: radius._15,
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  betaBadge: {
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    backgroundColor: colors.primary,
    borderRadius: radius._6,
  },
  tipContainer: {
    paddingLeft: spacingX._5,
  },
  tipText: {
    lineHeight: 22,
    letterSpacing: 0.2,
  },
});