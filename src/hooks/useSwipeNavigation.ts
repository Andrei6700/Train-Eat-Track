import { useRouter, usePathname } from "expo-router";

// tab order for navigation
const TAB_ORDER = [
  "/(tabs)",
  "/(tabs)/workout",
  "/(tabs)/nutrition",
  "/(tabs)/history",
  "/(tabs)/statistics",
  "/(tabs)/profile",
];

// Map for pathnames
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

  const getCurrentIndex = (): number => {
    if (PATH_MAP[pathname] !== undefined) {
      return PATH_MAP[pathname];
    }

    if (pathname.includes("/workout")) return 1;
    if (pathname.includes("/nutrition")) return 2;
    if (pathname.includes("/history")) return 3;
    if (pathname.includes("/statistics")) return 4;
    if (pathname.includes("/profile")) return 5;

    return 0;
  };

  const currentIndex = getCurrentIndex();
  const canSwipeLeft = currentIndex > 0;
  const canSwipeRight = currentIndex < TAB_ORDER.length - 1;

  const navigateLeft = () => {
    if (canSwipeLeft) {
      router.replace(TAB_ORDER[currentIndex - 1] as any);
    }
  };

  const navigateRight = () => {
    if (canSwipeRight) {
      router.replace(TAB_ORDER[currentIndex + 1] as any);
    }
  };

  return {
    navigateLeft,
    navigateRight,
    currentIndex,
    canSwipeLeft,
    canSwipeRight,
  };
};