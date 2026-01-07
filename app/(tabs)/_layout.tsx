import CustomTabs from '@/src/components/navigation/CustomTabs';
import { colors } from '@/constants/theme';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

const _layout = () => {
  return (
    <Tabs
      tabBar={(props) => <CustomTabs {...props} />}
      screenOptions={{ 
        headerShown: false,
        lazy: false, // Disable lazy loading for faster transitions
        animation: "none", // Disable animations for instant transitions
        freezeOnBlur: true, // Preserve state when switching tabs
      }}
      sceneContainerStyle={{
        backgroundColor: colors.neutral900,
      }}
    >
      <Tabs.Screen name='index' />
      <Tabs.Screen name='workout' />
      <Tabs.Screen name='nutrition' />
      <Tabs.Screen name='history' />
      <Tabs.Screen name='statistics' />
      <Tabs.Screen name='profile' />
    </Tabs>
  );
};

export default React.memo(_layout);

const styles = StyleSheet.create({});