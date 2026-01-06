import { colors } from "@/constants/theme";
import { useSwipeNavigation } from "@/src/hooks/useSwipeNavigation";
import React, { useRef } from "react";
import { PanResponder, StyleSheet, View } from "react-native";

type SwipeableScreenProps = {
  children: React.ReactNode;
  style?: any;
};

const SwipeableScreen: React.FC<SwipeableScreenProps> = ({
  children,
  style,
}) => {
  const { navigateLeft, navigateRight, canSwipeLeft, canSwipeRight } =
    useSwipeNavigation();

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        // it is a horizontal swipe if the absolute value of dx is greater than dy and greater than a threshold
        const isHorizontalSwipe = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 25;
        
        // Do not allow swipe if not valid
        if (dx > 0 && !canSwipeLeft) return false;
        if (dx < 0 && !canSwipeRight) return false;
        
        return isHorizontalSwipe;
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;

        // Check if the swipe is significant
        const isSignificantSwipe = Math.abs(dx) > 100 || Math.abs(vx) > 0.5;

        if (isSignificantSwipe) {
          if (dx > 0 && canSwipeLeft) {
            // Swipe right -> page on the left
            navigateLeft();
          } else if (dx < 0 && canSwipeRight) {
            // Swipe left -> page on the right
            navigateRight();
          }
        }
      },
    })
  ).current;

  return (
    <View
      style={[styles.container, style]}
      {...panResponder.panHandlers}
    >
      {children}
    </View>
  );
};

export default SwipeableScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral900,
  },
});