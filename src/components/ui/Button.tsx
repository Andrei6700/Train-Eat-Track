import { colors, radius } from '@/constants/theme';
import { CustomButtonProps } from '@/src/types/index';
import { scale, verticalScale } from '@/src/utils/styling';
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

const Button = ({
    style,
    buttonStyle,
    onPress,
    loading = false,
    children,
    disabled,
    ...touchableProps
}: CustomButtonProps) => {
    const isDisabled = Boolean(disabled || loading);

    return(
        <View style={[styles.outer, style, isDisabled && styles.outerDisabled]}>
            <Pressable 
                {...touchableProps}
                onPress={onPress}
                disabled={isDisabled}
                accessibilityRole={touchableProps.accessibilityRole || "button"}
                style={({ pressed }) => [
                    styles.button,
                    buttonStyle,
                    isDisabled && styles.buttonDisabled,
                    pressed && styles.pressed,
                ]}
            >
                {loading ? <ActivityIndicator size="small" color={colors.black} /> : children}
            </Pressable>
        </View>
    );
};

export default Button;

const styles = StyleSheet.create({
    outer: {
        position: "relative",
        width: '100%',
    },
    outerDisabled: {
        opacity: 0.4,
    },
    button: {
        backgroundColor: colors.primary,
        borderRadius: radius._12,
        borderWidth: 1,
        borderColor: colors.primaryDark,
        height: verticalScale(52),
        minHeight: verticalScale(52),
        paddingHorizontal: scale(16),
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    buttonDisabled: {
        backgroundColor: colors.primary,
        borderColor: colors.primaryDark,
    },
    pressed: {
        opacity: 0.8,
        transform: [{ scale: 0.97 }],
    },
});
