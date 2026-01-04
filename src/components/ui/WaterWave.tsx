import React, { useEffect } from "react";
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
  Text as SvgText,
} from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);

type WaterWaveProps = {
  percentage: number;
  total: number;
  goal: number;
};

const WaterWave = ({ percentage, total, goal }: WaterWaveProps) => {
  const wave1 = useSharedValue(0);
  const wave2 = useSharedValue(0);

  useEffect(() => {
    wave1.value = withRepeat(
      withTiming(20, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    wave2.value = withRepeat(
      withTiming(-20, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

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
    <View style={styles.container}>
      <Svg width={200} height={200} viewBox="0 0 200 200">
        <Defs>
          <ClipPath id="circle-clip">
            <Circle cx="100" cy="100" r="90" />
          </ClipPath>
          <LinearGradient id="water-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#60a5fa" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#3b82f6" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Background circle */}
        <Circle cx="100" cy="100" r="90" fill="#374151" />

        {/* Water with wave effect */}
        <G clipPath="url(#circle-clip)">
          <AnimatedPath
            animatedProps={animatedProps1}
            fill="url(#water-gradient)"
          />
          <AnimatedPath
            animatedProps={animatedProps2}
            fill="#60a5fa"
            opacity="0.5"
          />
        </G>

        {/* Border */}
        <Circle
          cx="100"
          cy="100"
          r="90"
          fill="none"
          stroke="#60a5fa"
          strokeWidth="4"
        />

        <G>
          {/* Percentage Text */}
          <SvgText
            x="100"
            y="90" 
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize="24"
            fontWeight="700"
            fill="white"
          >
            {Math.round(percentage)}%
          </SvgText>

          {/* Water amount text  */}
          <SvgText
            x="100"
            y="115" 
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize="16"
            fontWeight="600"
            fill="#9ca3af"
            letterSpacing="0.2"
          >
            {formatWaterText()}
          </SvgText>  
        </G>
      </Svg>
    </View>
  );
};

export default WaterWave;

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});