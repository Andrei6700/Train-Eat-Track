import { colors } from '@/constants/theme';
import { InputProps } from '@/src/types/index';
import { verticalScale, scale } from '@/src/utils/styling';
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

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
        placeholderTextColor={colors.neutral400}
        ref={inputRef && inputRef}
        {...textInputProps}
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
        minHeight: 52,
        alignItems: 'center',
        justifyContent: "center",
        borderWidth: 0,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.surfaceMid,
        paddingHorizontal: 14,
        paddingVertical: 0,
        gap: scale(8),
        width: '100%',
    },
    containerFocused: {
      borderWidth: 2,
      borderColor: colors.primary,
    },
    containerError: {
      borderWidth: 2,
      borderColor: colors.danger,
    },
    input:{
        flex: 1,
        color: colors.textLight,
        fontSize: verticalScale(15),
    }
})
