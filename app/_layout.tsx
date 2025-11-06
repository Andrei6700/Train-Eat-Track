import { AuthProvider } from "@/src/contexts/authContext";
import { NutritionProvider } from "@/src/contexts/nutritionContext";
import { WorkoutPlanProvider } from "@/src/contexts/workoutPlanContext";
import { Stack } from "expo-router";
import React from "react";
import 'react-native-reanimated';

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
      <Stack.Screen
        name="(modals)/mealDetail"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="(modals)/nutritionSettings"
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
        <NutritionProvider>
          <StackLayout />
        </NutritionProvider>
      </WorkoutPlanProvider>
    </AuthProvider>
  );
}