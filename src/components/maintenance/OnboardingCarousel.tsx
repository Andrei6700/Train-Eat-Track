import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Button from "@/src/components/ui/Button";
import Typo from "@/src/components/ui/Typo";
import useReduceMotion from "@/src/hooks/useReduceMotion";
import { scale, verticalScale } from "@/src/utils/styling";
import {
  ChartLineUp,
  Info,
  Scales,
  SunHorizon,
  TrendUp,
} from "phosphor-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/src/contexts/languageContext";
import { Dimensions, Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  runOnJS,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SLIDE_WIDTH = SCREEN_WIDTH - scale(48);

type OnboardingSlide = {
  icon: React.ReactNode;
  titleKey: string;
  textKey: string;
};

const SLIDES: OnboardingSlide[] = [
  {
    icon: (
      <Scales
        size={verticalScale(64)}
        color={colors.primary}
        weight="duotone"
      />
    ),
    titleKey: "maintenance_onboarding_slide1_title",
    textKey: "maintenance_onboarding_slide1_text",
  },
  {
    icon: (
      <SunHorizon
        size={verticalScale(64)}
        color={colors.warning}
        weight="duotone"
      />
    ),
    titleKey: "maintenance_onboarding_slide2_title",
    textKey: "maintenance_onboarding_slide2_text",
  },
  {
    icon: (
      <ChartLineUp
        size={verticalScale(64)}
        color={colors.success}
        weight="duotone"
      />
    ),
    titleKey: "maintenance_onboarding_slide3_title",
    textKey: "maintenance_onboarding_slide3_text",
  },
  {
    icon: (
      <TrendUp
        size={verticalScale(64)}
        color={colors.secondary}
        weight="duotone"
      />
    ),
    titleKey: "maintenance_onboarding_slide4_title",
    textKey: "maintenance_onboarding_slide4_text",
  },
  {
    icon: (
      <Info size={verticalScale(64)} color={colors.primary} weight="duotone" />
    ),
    titleKey: "maintenance_onboarding_slide5_title",
    textKey: "maintenance_onboarding_slide5_text",
  },
];

type OnboardingCarouselProps = {
  visible: boolean;
  onDismiss: () => void;
};

const OnboardingCarousel = ({
  visible,
  onDismiss,
}: OnboardingCarouselProps) => {
  const { t } = useLanguage();
  const reduceMotion = useReduceMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useSharedValue(0);
  const fadeOut = useSharedValue(1);

  // Reset state when modal becomes visible again
  useEffect(() => {
    if (visible) {
      fadeOut.value = 1;
      translateX.value = 0;
      setCurrentIndex(0);
    }
  }, [visible, fadeOut, translateX]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: fadeOut.value * 0.85,
  }));

  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: fadeOut.value,
    transform: [
      {
        scale: interpolate(fadeOut.value, [0, 1], [0.95, 1]),
      },
    ],
  }));

  const goToSlide = useCallback(
    (index: number) => {
      translateX.value = withSpring(-index * SLIDE_WIDTH, {
        damping: 20,
        stiffness: 100,
      });
      setCurrentIndex(index);
    },
    [translateX],
  );

  const handleNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      goToSlide(currentIndex + 1);
    }
  }, [currentIndex, goToSlide]);

  const handleDismiss = useCallback(() => {
    fadeOut.value = withTiming(
      0,
      {
        duration: reduceMotion ? 0 : 300,
        easing: Easing.out(Easing.ease),
      },
      (finished) => {
        if (finished) {
          runOnJS(onDismiss)();
        }
      },
    );
  }, [fadeOut, onDismiss, reduceMotion]);

  const handleDotPress = useCallback(
    (index: number) => {
      goToSlide(index);
    },
    [goToSlide],
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />
      <View style={styles.centeredContainer}>
        <Animated.View
          entering={
            reduceMotion
              ? undefined
              : SlideInDown.springify().damping(20).stiffness(100)
          }
          style={[styles.modalContent, animatedContentStyle]}
        >
          <View style={styles.slidesContainer}>
            <Animated.View
              style={[styles.slidesWrapper, animatedContainerStyle]}
            >
              {SLIDES.map((slide, index) => (
                <View
                  key={index}
                  style={[styles.slide, { width: SLIDE_WIDTH }]}
                >
                  <View style={styles.iconContainer}>{slide.icon}</View>
                  <Typo
                    size={verticalScale(20)}
                    fontWeight="700"
                    color={colors.text}
                    style={styles.title}
                  >
                    {t(slide.titleKey)}
                  </Typo>
                  <Typo
                    size={verticalScale(14)}
                    color={colors.textMuted}
                    style={styles.text}
                  >
                    {t(slide.textKey)}
                  </Typo>
                </View>
              ))}
            </Animated.View>
          </View>

          <View style={styles.dotsContainer}>
            {SLIDES.map((_, index) => (
              <Pressable
                key={index}
                onPress={() => handleDotPress(index)}
                hitSlop={8}
              >
                <Animated.View
                  entering={
                    reduceMotion ? undefined : FadeIn.delay(index * 100)
                  }
                  style={[
                    styles.dot,
                    index === currentIndex && styles.dotActive,
                  ]}
                />
              </Pressable>
            ))}
          </View>

          <View style={styles.buttonContainer}>
            {isLastSlide ? (
              <Button onPress={handleDismiss}>
                <Typo
                  size={verticalScale(16)}
                  fontWeight="700"
                  color={colors.black}
                >
                  {t("maintenance_onboarding_dismiss")}
                </Typo>
              </Button>
            ) : (
              <Button onPress={handleNext}>
                <Typo
                  size={verticalScale(16)}
                  fontWeight="700"
                  color={colors.black}
                >
                  {t("maintenance_onboarding_next")}
                </Typo>
              </Button>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default OnboardingCarousel;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.black,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacingX._20,
  },
  modalContent: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius._15,
    paddingVertical: spacingY._25,
    width: "100%",
    maxWidth: 500,
    overflow: "hidden",
  },
  slidesContainer: {
    overflow: "hidden",
  },
  slidesWrapper: {
    flexDirection: "row",
  },
  slide: {
    paddingHorizontal: spacingX._20,
    alignItems: "center",
  },
  iconContainer: {
    width: verticalScale(100),
    height: verticalScale(100),
    borderRadius: verticalScale(50),
    backgroundColor: colors.surfaceMid,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacingY._20,
  },
  title: {
    textAlign: "center",
    marginBottom: spacingY._15,
  },
  text: {
    textAlign: "center",
    lineHeight: verticalScale(22),
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: scale(8),
    marginTop: spacingY._20,
    marginBottom: spacingY._20,
  },
  dot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: colors.surfaceMid,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: scale(24),
  },
  buttonContainer: {
    paddingHorizontal: spacingX._20,
  },
});
