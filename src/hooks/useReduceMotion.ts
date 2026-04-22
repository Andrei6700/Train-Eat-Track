import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

const useReduceMotion = () => {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!isMounted) return;
        setReduceMotionEnabled(Boolean(enabled));
      })
      .catch(() => null);

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        setReduceMotionEnabled(Boolean(enabled));
      },
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotionEnabled;
};

export default useReduceMotion;
