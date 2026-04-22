import React, { useEffect } from "react";
import { colors } from "@/constants/theme";
import useReduceMotion from "@/src/hooks/useReduceMotion";
import { StyleSheet, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedProps,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import Svg, {
    Circle,
    ClipPath,
    Defs,
    G,
    LinearGradient,
    Path,
    Stop,
} from "react-native-svg";
import Typo from "./Typo";

const AnimatedPath = Animated.createAnimatedComponent(Path);

type WaterWaveProps = {
  percentage: number;
  total: number;
  goal: number;
  size?: number;
};

const WaterWave = ({ percentage, total, goal, size = 150 }: WaterWaveProps) => {
  const reduceMotion = useReduceMotion();
  const wave1 = useSharedValue(0);
  const wave2 = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      wave1.value = 0;
      wave2.value = 0;
      return;
    }

    wave1.value = withRepeat(
      withTiming(20, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    wave2.value = withRepeat(
      withTiming(-20, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [reduceMotion, wave1, wave2]);

  const animatedProps1 = useAnimatedProps(() => {
    const y = 200 - percentage * 2;
    return {
      d: `M 0 ${y + wave1.value}
         Q 25 ${y + wave1.value - 5}, 50 ${y + wave1.value}
         T 100 ${y + wave1.value}
         T 150 ${y + wave1.value}
         T 200 ${y + wave1.value}
         L 200 200 L 0 200 Z`,
    };
  });

  const animatedProps2 = useAnimatedProps(() => {
    const y = 205 - percentage * 2;
    return {
      d: `M 0 ${y + wave2.value}
         Q 25 ${y + wave2.value + 5}, 50 ${y + wave2.value}
         T 100 ${y + wave2.value}
         T 150 ${y + wave2.value}
         T 200 ${y + wave2.value}
         L 200 200 L 0 200 Z`,
    };
  });

  // Format the water amount text
  const formatWaterText = () => {
    if (total === 0) {
      return "0 din 2 L";
    }
    return `${(total / 1000).toFixed(1)} din ${goal / 1000} L`;
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <ClipPath id="circle-clip">
            <Circle cx="100" cy="100" r="90" />
          </ClipPath>
          <LinearGradient id="water-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={colors.waterStart} stopOpacity="0.75" />
            <Stop offset="100%" stopColor={colors.waterEnd} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Background circle */}
        <Circle cx="100" cy="100" r="90" fill={colors.surfaceRaised} />

        {/* Water with wave effect */}
        <G clipPath="url(#circle-clip)">
          <AnimatedPath
            animatedProps={animatedProps1}
            fill="url(#water-gradient)"
          />
          <AnimatedPath
            animatedProps={animatedProps2}
            fill={colors.waterAccent}
            opacity="0.5"
          />
        </G>

        {/* Border */}
        <Circle
          cx="100"
          cy="100"
          r="90"
          fill="none"
          stroke={colors.border}
          strokeWidth="4"
        />
      </Svg>

      {/* Text overlay  */}
      <View style={styles.textOverlay}>
        <Typo size={48} variant="metric" color={colors.white} style={styles.percentageText}>
          {Math.round(percentage)}%
        </Typo>
        <Typo size={14} variant="mono" color={colors.neutral100} style={styles.waterText}>
          {formatWaterText()}
        </Typo>
      </View>
    </View>
  );
};

export default WaterWave;

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  textOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  percentageText: {
    textAlign: "center",
    textShadowColor: colors.black,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  waterText: {
    textAlign: "center",
    marginTop: 4,
    textShadowColor: colors.black,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
