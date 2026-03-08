import { colors, radius } from '@/constants/theme';
import { CustomButtonProps } from '@/src/types/index';
import { verticalScale, scale } from '@/src/utils/styling';
import React from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";

const Button = ({
    style,
    onPress,
    loading = false,
    children,
    disabled,
    activeOpacity,
    ...touchableProps
}: CustomButtonProps) => {
    const isDisabled = Boolean(disabled || loading);

    return(
        <TouchableOpacity 
        {...touchableProps}
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={activeOpacity ?? 0.85}
        style={[styles.button, style, isDisabled && styles.buttonDisabled]}>
            {loading ? <ActivityIndicator size="small" color={colors.black} /> : children}
        </TouchableOpacity>
    );
};

export default Button;

const styles = StyleSheet.create({
    button: {
        backgroundColor: colors.primary,
        borderRadius: radius._17,
        borderCurve: 'continuous',
        height: verticalScale(52),
        minHeight: verticalScale(48),
        paddingHorizontal: scale(20),
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    buttonDisabled: {
        opacity: 0.9,
    },
});
