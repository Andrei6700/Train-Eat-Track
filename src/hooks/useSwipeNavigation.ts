import { useRouter, usePathname } from "expo-router";
import { useCallback, useMemo } from "react";

// Order of tabs for navigation
const TAB_ORDER = [
  "/(tabs)",
  "/(tabs)/workout",
  "/(tabs)/nutrition",
  "/(tabs)/history",
  "/(tabs)/statistics",
  "/(tabs)/profile",
];

// path to index mapping
const PATH_MAP: Record<string, number> = {
  "/": 0,
  "/(tabs)": 0,
  "/index": 0,
  "/workout": 1,
  "/nutrition": 2,
  "/history": 3,
  "/statistics": 4,
  "/profile": 5,
};

export const useSwipeNavigation = () => {
  const router = useRouter();
  const pathname = usePathname();

  const currentIndex = useMemo((): number => {
    if (PATH_MAP[pathname] !== undefined) {
      return PATH_MAP[pathname];
    }

    if (pathname.includes("/workout")) return 1;
    if (pathname.includes("/nutrition")) return 2;
    if (pathname.includes("/history")) return 3;
    if (pathname.includes("/statistics")) return 4;
    if (pathname.includes("/profile")) return 5;

    return 0;
  }, [pathname]);

  const canSwipeLeft = useMemo(() => currentIndex > 0, [currentIndex]);
  const canSwipeRight = useMemo(
    () => currentIndex < TAB_ORDER.length - 1,
    [currentIndex]
  );

  const navigateLeft = useCallback(() => {
    if (canSwipeLeft) {
      const nextRoute = TAB_ORDER[currentIndex - 1];
      router.replace(nextRoute as any);
    }
  }, [canSwipeLeft, currentIndex, router]);

  const navigateRight = useCallback(() => {
    if (canSwipeRight) {
      const nextRoute = TAB_ORDER[currentIndex + 1];
      router.replace(nextRoute as any);
    }
  }, [canSwipeRight, currentIndex, router]);

  return {
    navigateLeft,
    navigateRight,
    currentIndex,
    canSwipeLeft,
    canSwipeRight,
  };
};