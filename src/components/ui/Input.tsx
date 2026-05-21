import { colors, fontFamilies, radius } from '@/constants/theme';
import { InputProps } from '@/src/types/index';
import { verticalScale, scale } from '@/src/utils/styling';
import React, { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

const Input = (props: InputProps) => {
  const {
    icon,
    containerStyle,
    inputStyle,
    inputRef,
    hasError,
    onFocus,
    onBlur,
    ...textInputProps
  } = props;
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
        hasError && styles.containerError,
        containerStyle && containerStyle,
      ]}
    >
      {icon && icon}
      <TextInput 
        style={[styles.input, inputStyle]}
        placeholderTextColor={colors.textMuted}
        ref={inputRef && inputRef}
        {...textInputProps}
        scrollEnabled={false}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
      />
    </View>
  )
}

export default Input

const styles = StyleSheet.create({
    container:{
        flexDirection: 'row',
        minHeight: verticalScale(52),
        alignItems: 'center',
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius._12,
        backgroundColor: colors.surfaceRaised,
        paddingHorizontal: scale(16),
        paddingVertical: verticalScale(12),
        gap: scale(8),
        width: '100%',
    },
    containerFocused: {
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    containerError: {
      borderWidth: 1.5,
      borderColor: colors.secondary,
    },
    input:{
        flex: 1,
        color: colors.textPrimary,
        fontSize: verticalScale(16),
        fontFamily: fontFamilies.bodyRegular,
        minHeight: verticalScale(24),
        paddingVertical: 0,
        textAlignVertical: 'center',
        ...(Platform.OS === 'android' && { includeFontPadding: false }),
    }
})

