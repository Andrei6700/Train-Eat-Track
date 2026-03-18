import { WorkoutHistory } from "@/src/types/index";

type CacheEntry = {
  data: WorkoutHistory[];
  updatedAt: number;
};

const workoutHistoryCache = new Map<string, CacheEntry>();

export const getWorkoutHistoryMemoryCache = (
  userId: string,
  maxAgeMs = 60_000,
): WorkoutHistory[] | null => {
  const cached = workoutHistoryCache.get(userId);
  if (!cached) return null;

  if (Date.now() - cached.updatedAt > maxAgeMs) {
    workoutHistoryCache.delete(userId);
    return null;
  }

  return cached.data;
};

export const setWorkoutHistoryMemoryCache = (
  userId: string,
  workouts: WorkoutHistory[],
): void => {
  workoutHistoryCache.set(userId, {
    data: workouts,
    updatedAt: Date.now(),
  });
};

export const clearWorkoutHistoryMemoryCache = (userId?: string): void => {
  if (!userId) {
    workoutHistoryCache.clear();
    return;
  }

  workoutHistoryCache.delete(userId);
};
