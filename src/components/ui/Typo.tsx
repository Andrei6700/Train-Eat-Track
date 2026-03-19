import { colors } from "@/constants/theme";
import { TypoProps } from '@/src/types/index';
import { verticalScale, scale } from '@/src/utils/styling';
import { Platform, Text, TextStyle } from "react-native";

const fontFamily = Platform.select({
    ios: "Inter",
    android: "sans-serif",
    default: "System",
}) || "System";

const Typo = ({
    size,
    color = colors.text,
    fontWeight = "600",
    children,
    style,
    textProps = {},
    ...restTextProps
}: TypoProps) => {
    const computedSize = size ? Math.min(verticalScale(size), scale(35)) : verticalScale(15);
    const textStyle : TextStyle = {
        fontSize: computedSize,
        lineHeight: Math.round(computedSize * 1.25),
        color,
        fontWeight,
        fontFamily,
        flexWrap: 'wrap',
    };
    return (
        <Text style ={[textStyle, style]} {...restTextProps} {...textProps}>
            {children}
        </Text>
    );
};

export default Typo;
