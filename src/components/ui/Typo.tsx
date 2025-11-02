import { colors } from "@/constants/theme";
import { TypoProps } from '@/src/types/index';
import { verticalScale, scale } from '@/src/utils/styling';
import { StyleSheet, Text, TextStyle } from "react-native";

const Typo = ({
    size,
    color = colors.text,
    fontWeight = "400",
    children,
    style,
    textProps = {},
}: TypoProps) => {
    const textStyle : TextStyle = {
        fontSize: size ? Math.min(verticalScale(size), scale(24)) : verticalScale(18),
        color,
        fontWeight,
        flexWrap: 'wrap',
    };
    return (
        <Text style ={[textStyle, style]} {...textProps}>
            {children}
        </Text>
    );
};

export default Typo;

const styles = StyleSheet.create({});