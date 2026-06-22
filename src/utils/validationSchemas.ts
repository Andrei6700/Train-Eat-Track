/**
 * validationSchemas.ts
 *
 * Centralised Zod schemas for validating data at the service boundary.
 *
 * Usage:
 *   import { workoutHistorySchema } from "@/src/utils/validationSchemas";
 *   const result = workoutHistorySchema.safeParse(rawData);
 *   if (!result.success) { ... }
 */

import { z } from "zod";

// ─── Workout ─────────────────────────────────────────────────────────────────

export const workoutSetSchema = z.object({
    reps: z.number().int().min(0).max(9999),
    weight: z.number().min(0).max(99999),
    weightUnit: z.enum(["kg", "lbs"]),
});

export const workoutExerciseSchema = z.object({
    exerciseName: z.string().trim().min(1, "Exercise name is required"),
    sets: z.array(workoutSetSchema).min(1).max(100),
});

export const workoutHistorySchema = z.object({
    userID: z.string().min(1),
    date: z.union([z.string(), z.date()]),
    duration: z.number().int().min(0),
    exercises: z.array(workoutExerciseSchema),
    isRestDay: z.boolean().optional().default(false),
});

// ─── Nutrition ───────────────────────────────────────────────────────────────

export const foodSchema = z.object({
    name: z.string().trim().min(1),
    calories: z.number().min(0).max(99999),
    protein: z.number().min(0).max(99999),
    carbs: z.number().min(0).max(99999),
    fat: z.number().min(0).max(99999),
    servingSize: z.string().min(1),
    image: z.string().url().optional().or(z.literal("")),
});

export const mealSchema = z.object({
    mealName: z.string().trim().min(1),
    foods: z.array(foodSchema),
});

export const dailyNutritionSchema = z.object({
    userID: z.string().min(1),
    date: z.union([z.string(), z.date()]),
    calorieGoal: z.number().int().min(0).max(99999),
    proteinGoal: z.number().min(0).max(99999),
    carbsGoal: z.number().min(0).max(99999),
    fatGoal: z.number().min(0).max(99999),
    meals: z.array(mealSchema),
});

// ─── Water ───────────────────────────────────────────────────────────────────

export const waterIntakeSchema = z.object({
    amount: z.number().min(0).max(50000),
    timestamp: z.union([z.string(), z.date()]),
});

export const dailyWaterSchema = z.object({
    userID: z.string().min(1),
    date: z.union([z.string(), z.date()]),
    goal: z.number().int().min(0).max(50000),
    intakes: z.array(waterIntakeSchema),
    total: z.number().min(0).max(50000),
});

// ─── Workout Plan ────────────────────────────────────────────────────────────

export const dayWorkoutSchema = z.object({
    day: z.string().trim().min(1),
    isRestDay: z.boolean(),
    exercises: z.array(
        z.object({
            exerciseName: z.string().trim().min(1),
            sets: z.array(workoutSetSchema),
        }),
    ),
    notes: z.string().optional(),
});

export const workoutPlanSchema = z.object({
    userID: z.string().min(1),
    planName: z.string().trim().min(1),
    splitDays: z.number().int().min(1).max(60).optional(),
    days: z.array(dayWorkoutSchema).min(1),
});

// ─── Auth ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    name: z.string().trim().min(1, "Name is required"),
});

// ─── Type inference ──────────────────────────────────────────────────────────

export type WorkoutSetInput = z.infer<typeof workoutSetSchema>;
export type WorkoutHistoryInput = z.infer<typeof workoutHistorySchema>;
export type FoodInput = z.infer<typeof foodSchema>;
export type DailyNutritionInput = z.infer<typeof dailyNutritionSchema>;
export type WorkoutPlanInput = z.infer<typeof workoutPlanSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;