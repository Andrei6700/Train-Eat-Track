import { colors, radius } from '@/constants/theme';
import { BackButtonProps } from '@/src/types/index';
import { verticalScale } from '@/src/utils/styling';
import { useRouter } from 'expo-router';
import { CaretLeftIcon } from 'phosphor-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

const BackButton = ({
    style,
    buttonStyle,
    iconSize = 26,
    onPress,
}:BackButtonProps) => {
    const router = useRouter();
  return (
   <View style={[styles.outer, style]}>
      <View style={styles.shadowLayer} />
      <Pressable
        onPress={onPress || (() => router.back())}
        style={({ pressed }) => [styles.button, buttonStyle, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <CaretLeftIcon
          size={verticalScale(iconSize)}
          color={colors.black}
          weight='bold'
        />
      </Pressable>
   </View>
  );
};

export default BackButton

const styles = StyleSheet.create({
    outer: {
        position: 'relative',
        marginRight: 6,
        marginBottom: 6,
        alignSelf: 'flex-start',
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
    button:{
        minWidth: 44,
        minHeight: 44,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius._10,
        borderWidth: 2,
        borderColor: colors.black,
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    pressed: {
        transform: [{ translateX: 3 }, { translateY: 3 }],
        opacity: 0.95,
    },
});
