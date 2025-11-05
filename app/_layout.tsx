import { AuthProvider } from "@/src/contexts/authContext";
import { WorkoutPlanProvider } from "@/src/contexts/workoutPlanContext";
import { Stack } from "expo-router";
import React, { useEffect } from "react";
import 'react-native-reanimated';

// Configurare pentru a dezactiva warning-urile Layout Animations
if (__DEV__) {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('setLayoutAnimationEnabledExperimental')
    ) {
      return;
    }
    originalWarn(...args);
  };
}

const StackLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen
        name="(modals)/profileModal"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="(modals)/addWorkout"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="(modals)/workoutPlan"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="(modals)/dayWorkout"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="(modals)/workoutDetail"
        options={{
          presentation: "modal",
        }}
      />
    </Stack>
  );
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <WorkoutPlanProvider>
        <StackLayout />
      </WorkoutPlanProvider>
    </AuthProvider>
  );
}