import { colors, radius } from '@/constants/theme';
import { InputProps } from '@/src/types/index';
import { verticalScale, scale } from '@/src/utils/styling';
import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

const Input = (props: InputProps) => {
  return (
    <View style={[styles.container, props.containerStyle && props.containerStyle]}>
        {
            props.icon && props.icon
        }
      <TextInput 
        style={[styles.input, props.inputStyle]}
        placeholderTextColor={colors.neutral400}
        ref={props.inputRef && props.inputRef}
        {...props}
      />
    </View>
  )
}

export default Input

const styles = StyleSheet.create({
    container:{
        flexDirection: 'row',
        height: verticalScale(54),
        minHeight: verticalScale(48),
        alignItems: 'center',
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.neutral300,
        borderRadius: radius._17,
        borderCurve: 'continuous',
        paddingHorizontal: scale(15),
        gap: scale(10),
        width: '100%',
    },
    input:{
        flex: 1,
        height: '100%',
        color: colors.white,
        fontSize: verticalScale(14),
    }
})