import { scale, verticalScale } from '@/src/utils/styling';

export const colors = {
  // Brand
  primary: "#A8E10C",
  primaryLight: "#C8F45A",
  primaryDark: "#6E9800",
  secondary: "#FF3D00",
  accent: "#7B61FF",

  // Semantic
  success: "#22C55E",
  warning: "#FF3D00",
  danger: "#FF3D00",
  rose: "#FF3D00",
  green: "#22C55E",

  // Surfaces
  background: "#0A0A0A",
  surface: "#141414",
  surfaceCard: "#141414",
  surfaceRaised: "#1E1E1E",
  surfaceMid: "#1E1E1E",

  // Text
  text: "#F5F5F5",
  textPrimary: "#F5F5F5",
  textMuted: "#6B6B6B",
  textLight: "#F5F5F5",
  textLighter: "#6B6B6B",

  // Borders
  border: "#2A2A2A",

  // Base
  black: "#0A0A0A",
  white: "#FFFFFF",
  cardShadow: "#000000",

  // Neutral scale
  neutral50: "#FFFFFF",
  neutral100: "#F5F5F5",
  neutral200: "#E5E5E5",
  neutral300: "#CFCFCF",
  neutral350: "#A3A3A3",
  neutral400: "#6B6B6B",
  neutral500: "#4A4A4A",
  neutral600: "#3A3A3A",
  neutral700: "#2A2A2A",
  neutral800: "#1E1E1E",
  neutral900: "#141414",

  // Navigation
  tabBar: "#0D0D0D",
  tabIndicator: "#A8E10C",

  // Charts / nutrition / badges
  purple: "#7B61FF",
  chartSuccess: "#22C55E",
  chartWarning: "#FFB020",
  chartDanger: "#FF3D00",
  chartProgress: "#A8E10C",
  macroProtein: "#22C55E",
  macroCarbs: "#7B61FF",
  macroFat: "#FFB020",
  waterStart: "#60A5FA",
  waterEnd: "#2563EB",
  waterAccent: "#3B82F6",
  badgeStreakBackground: "#1A1A00",
};

export const spacingX = {
  _3: scale(4),
  _5: scale(4),
  _7: scale(8),
  _10: scale(12),
  _12: scale(12),
  _15: scale(16),
  _20: scale(24),
  _25: scale(24),
  _30: scale(32),
  _35: scale(32),
  40: scale(48),
};

export const spacingY = {
  _5: verticalScale(4),
  _7: verticalScale(8),
  _10: verticalScale(12),
  _12: verticalScale(12),
  _15: verticalScale(16),
  _17: verticalScale(16),
  _20: verticalScale(24),
  _25: verticalScale(24),
  _30: verticalScale(32),
  _35: verticalScale(32),
  _40: verticalScale(48),
  _50: verticalScale(48),
  60: verticalScale(48),
};

export const radius = {
  _3: verticalScale(4),
  _6: verticalScale(8),
  _10: verticalScale(10),
  _12: verticalScale(12),
  _15: verticalScale(16),
  _17: verticalScale(16),
  _20: verticalScale(16),
  _30: verticalScale(24),
  full: 999,
};

export const fontFamilies = {
  heading: "BebasNeue_400Regular",
  bodyRegular: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
  mono: "JetBrainsMono_600SemiBold",
  monoRegular: "JetBrainsMono_400Regular",
};

export const typeScale = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  display: 32,
  metric: 48,
};
