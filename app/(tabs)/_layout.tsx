import CustomTabs from '@/src/components/navigation/CustomTabs';
import { colors } from '@/constants/theme';
import { useAuth } from '@/src/contexts/authContext';
import { prefetchNutritionCalendarSummary } from '@/src/services/nutritionService';
import { prefetchWorkoutHistorySnapshot } from '@/src/services/workoutService';
import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { InteractionManager } from 'react-native';

const TabsLayout = () => {
  const { user } = useAuth();

  useEffect(() => {
    const userId = user?.uid;
    if (!userId) return;

    const interaction = InteractionManager.runAfterInteractions(() => {
      void Promise.allSettled([
        prefetchWorkoutHistorySnapshot(userId),
        prefetchNutritionCalendarSummary(userId),
      ]);
    });

    return () => {
      interaction.cancel();
    };
  }, [user?.uid]);

  return (
    <Tabs
      tabBar={(props) => <CustomTabs {...props} />}
      screenOptions={{ 
        headerShown: false,
        lazy: true,
        animation: "none",
        freezeOnBlur: true, // Preserve state when switching tabs
      }}
      sceneContainerStyle={{
        backgroundColor: colors.background,
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

export default React.memo(TabsLayout);
