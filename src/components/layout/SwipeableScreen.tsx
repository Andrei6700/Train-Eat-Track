import { colors } from "@/constants/theme";
import { useSwipeNavigation } from "@/src/hooks/useSwipeNavigation";
import React, { useCallback, useMemo, useRef } from "react";
import { PanResponder, StyleSheet, View } from "react-native";

type SwipeableScreenProps = {
  children: React.ReactNode;
  style?: any;
};

const SwipeableScreen: React.FC<SwipeableScreenProps> = React.memo(({
  children,
  style,
}) => {
  const { navigateLeft, navigateRight, canSwipeLeft, canSwipeRight } =
    useSwipeNavigation();

  const isSwipingRef = useRef(false);
  const swipeStartTime = useRef(0);

  // Handler functions 
  const handleMoveShouldSetPanResponder = useCallback((_, gestureState) => {
    const { dx, dy } = gestureState;
    
    const isHorizontalSwipe = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20;
    
    if (!isHorizontalSwipe) return false;
    if (dx > 0 && !canSwipeLeft) return false;
    if (dx < 0 && !canSwipeRight) return false;
    
    return true;
  }, [canSwipeLeft, canSwipeRight]);

  const handlePanResponderGrant = useCallback(() => {
    isSwipingRef.current = false;
    swipeStartTime.current = Date.now();
  }, []);

  const handlePanResponderMove = useCallback((_, gestureState) => {
    const { dx } = gestureState;
    if (Math.abs(dx) > 30 && !isSwipingRef.current) {
      isSwipingRef.current = true;
    }
  }, []);

  const handlePanResponderRelease = useCallback((_, gestureState) => {
    const { dx, vx } = gestureState;
    const swipeDuration = Date.now() - swipeStartTime.current;
    
    const isQuickSwipe = swipeDuration < 300 && Math.abs(vx) > 0.3;
    const isLongSwipe = Math.abs(dx) > 100;
    
    if (isQuickSwipe || isLongSwipe) {
      if (dx > 0 && canSwipeLeft) {
        requestAnimationFrame(() => navigateLeft());
      } else if (dx < 0 && canSwipeRight) {
        requestAnimationFrame(() => navigateRight());
      }
    }
    
    isSwipingRef.current = false;
  }, [canSwipeLeft, canSwipeRight, navigateLeft, navigateRight]);

  const handlePanResponderTerminate = useCallback(() => {
    isSwipingRef.current = false;
  }, []);

  //  create panResponder in useMemo, without Hooks inside
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: handleMoveShouldSetPanResponder,
        onPanResponderGrant: handlePanResponderGrant,
        onPanResponderMove: handlePanResponderMove,
        onPanResponderRelease: handlePanResponderRelease,
        onPanResponderTerminate: handlePanResponderTerminate,
      }),
    [
      handleMoveShouldSetPanResponder,
      handlePanResponderGrant,
      handlePanResponderMove,
      handlePanResponderRelease,
      handlePanResponderTerminate,
    ]
  );

  return (
    <View
      style={[styles.container, style]}
      {...panResponder.panHandlers}
    >
      {children}
    </View>
  );
});

SwipeableScreen.displayName = 'SwipeableScreen';

export default SwipeableScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
});
