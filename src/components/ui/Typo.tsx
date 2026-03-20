import { colors, fontFamilies, typeScale } from "@/constants/theme";
import { TypoProps } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { Text, TextStyle } from "react-native";

const getBodyFontFamily = (fontWeight: TypoProps["fontWeight"]) => {
  if (fontWeight === "400" || fontWeight === "normal") {
    return fontFamilies.bodyRegular;
  }
  if (fontWeight === "500") {
    return fontFamilies.bodyMedium;
  }
  return fontFamilies.bodySemiBold;
};

const getMonoFontFamily = (fontWeight: TypoProps["fontWeight"]) =>
  fontWeight === "400" || fontWeight === "normal"
    ? fontFamilies.monoRegular
    : fontFamilies.mono;

const Typo = ({
  size,
  color = colors.textPrimary,
  fontWeight = "600",
  children,
  style,
  textProps = {},
  variant = "body",
  family,
  uppercase = false,
  ...restTextProps
}: TypoProps) => {
  const resolvedSize = size ? verticalScale(size) : verticalScale(typeScale.md);

  const resolvedFamily = (() => {
    if (family === "heading") return fontFamilies.heading;
    if (family === "mono") return getMonoFontFamily(fontWeight);
    if (family === "body") return getBodyFontFamily(fontWeight);
    if (variant === "heading" || variant === "metric") return fontFamilies.heading;
    if (variant === "mono") return getMonoFontFamily(fontWeight);
    return getBodyFontFamily(fontWeight);
  })();

  const lineHeightMultiplier =
    variant === "heading" || variant === "metric" ? 1.05 : 1.25;

  const textStyle: TextStyle = {
    fontSize: resolvedSize,
    lineHeight: Math.round(resolvedSize * lineHeightMultiplier),
    color,
    fontWeight: variant === "heading" || variant === "metric" ? "400" : fontWeight,
    fontFamily: resolvedFamily,
    flexWrap: "wrap",
    textTransform: uppercase ? "uppercase" : "none",
    letterSpacing: variant === "label" ? 1.5 : 0,
  };

  return (
    <Text style={[textStyle, style]} {...restTextProps} {...textProps}>
      {children}
    </Text>
  );
};

export default Typo;
