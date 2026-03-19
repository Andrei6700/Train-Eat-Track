import { colors, radius } from '@/constants/theme';
import { CustomButtonProps } from '@/src/types/index';
import { verticalScale, scale } from '@/src/utils/styling';
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
            <View style={styles.shadowLayer} />
            <Pressable 
                {...touchableProps}
                onPress={onPress}
                disabled={isDisabled}
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
        position: 'relative',
        marginBottom: 6,
        marginRight: 6,
        width: '100%',
    },
    outerDisabled: {
        opacity: 0.75,
    },
    shadowLayer: {
        position: 'absolute',
        top: 4,
        left: 4,
        right: -4,
        bottom: -4,
        backgroundColor: colors.black,
        borderRadius: radius._10,
    },
    button: {
        backgroundColor: colors.primary,
        borderRadius: radius._10,
        borderWidth: 2,
        borderColor: colors.black,
        height: verticalScale(52),
        minHeight: 44,
        paddingHorizontal: scale(16),
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    buttonDisabled: {
        backgroundColor: '#E5E7EB',
        borderColor: '#9CA3AF',
    },
    pressed: {
        transform: [{ translateX: 3 }, { translateY: 3 }],
        opacity: 0.95,
    },
});
