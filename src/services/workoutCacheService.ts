import { WorkoutHistory } from "@/src/types/index";
import { getUserWorkouts } from "./workoutService";

type CachedWorkoutMonth = {
  year: number;
  month: number;
  workoutDays: Set<number>;
  totalWorkouts: number;
  totalDuration: number;
  activeDays: number;
};

type FirstWorkoutInfo = {
  year: number;
  month: number;
};

const monthCache = new Map<string, CachedWorkoutMonth>();
let allWorkoutsCache: WorkoutHistory[] | null = null;
let firstWorkoutInfo: FirstWorkoutInfo | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (year: number, month: number): string => {
  return `${year}-${month}`;
};

const isCacheValid = (): boolean => {
  return Date.now() - cacheTimestamp < CACHE_DURATION;
};

export const loadAllWorkouts = async (userID: string): Promise<WorkoutHistory[]> => {
  if (allWorkoutsCache && isCacheValid()) {
    return allWorkoutsCache;
  }

  const result = await getUserWorkouts(userID);
  if (result.success && result.data) {
    allWorkoutsCache = result.data;
    cacheTimestamp = Date.now();
    return allWorkoutsCache;
  }

  return [];
};

export const getFirstWorkoutMonth = async (userID: string): Promise<FirstWorkoutInfo | null> => {
  if (firstWorkoutInfo && isCacheValid()) {
    return firstWorkoutInfo;
  }

  const workouts = await loadAllWorkouts(userID);
  
  if (workouts.length === 0) {
    const today = new Date();
    firstWorkoutInfo = {
      year: today.getFullYear(),
      month: today.getMonth(),
    };
    return firstWorkoutInfo;
  }

  // Sort workouts by date ascending to find first workout
  const sorted = [...workouts].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const firstWorkout = new Date(sorted[0].date);
  firstWorkoutInfo = {
    year: firstWorkout.getFullYear(),
    month: firstWorkout.getMonth(),
  };

  return firstWorkoutInfo;
};

export const getMonthWorkoutData = async (
  userID: string,
  year: number,
  month: number
): Promise<CachedWorkoutMonth> => {
  const key = getCacheKey(year, month);

  if (monthCache.has(key) && isCacheValid()) {
    return monthCache.get(key)!;
  }

  const workouts = await loadAllWorkouts(userID);

  const workoutDays = new Set<number>();
  let totalWorkouts = 0;
  let totalDuration = 0;

  workouts.forEach((workout) => {
    const workoutDate = new Date(workout.date);
    if (workoutDate.getFullYear() === year && workoutDate.getMonth() === month) {
      workoutDays.add(workoutDate.getDate());
      totalWorkouts++;
      totalDuration += workout.duration || 0;
    }
  });

  const monthData: CachedWorkoutMonth = {
    year,
    month,
    workoutDays,
    totalWorkouts,
    totalDuration,
    activeDays: workoutDays.size,
  };

  monthCache.set(key, monthData);
  return monthData;
};

export const invalidateCache = () => {
  monthCache.clear();
  allWorkoutsCache = null;
  firstWorkoutInfo = null;
  cacheTimestamp = 0;
};

export const invalidateMonthCache = (year: number, month: number) => {
  const key = getCacheKey(year, month);
  monthCache.delete(key);
  allWorkoutsCache = null;
  cacheTimestamp = 0;
};