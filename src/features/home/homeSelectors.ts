import { WorkoutHistory, WorkoutPlan } from "@/src/types/index";
import { DAY_IN_MS, startOfDay, toDateKey, toValidDate } from "@/src/utils/dateKey";
import {
    getCycleDayIndicesWithWorkouts,
    getCycleDayNameFromDate,
    shouldAutoConvertToRestDay,
} from "@/src/utils/workoutPlanCycle";

export type HomeQuickStats = {
  totalWorkouts: number;
  totalHoursDisplay: string;
  currentStreak: number;
};

export type HomeWeekData = {
  days: number[];
  restDays: boolean[];
  workoutDaysCount: number;
};

export type HomeDerivedData = {
  nonRestWorkouts: WorkoutHistory[];
  quickStats: HomeQuickStats;
  weekData: HomeWeekData;
  recentWorkouts: WorkoutHistory[];
};

const MAX_STREAK_LOOKBACK_DAYS = 3650;

const getDayStart = (value: Date | string): Date | null => {
  const parsedDate = toValidDate(value);
  if (!parsedDate) return null;
  return startOfDay(parsedDate);
};

const shiftDays = (date: Date, delta: number): Date => {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + delta);
  return shifted;
};

const buildCompletedDaySet = (workouts: WorkoutHistory[]): Set<string> => {
  const completedDaySet = new Set<string>();

  for (const workout of workouts) {
    if (workout.isRestDay) continue;
    const parsedDate = getDayStart(workout.date);
    if (!parsedDate) continue;
    completedDaySet.add(toDateKey(parsedDate));
  }

  return completedDaySet;
};

const buildPlanDayMap = (
  workoutPlan: WorkoutPlan | null | undefined,
): Map<string, boolean> => {
  const dayMap = new Map<string, boolean>();
  if (!workoutPlan?.days?.length) return dayMap;

  for (const day of workoutPlan.days) {
    dayMap.set(day.day, Boolean(day.isRestDay));
  }

  return dayMap;
};

const isPlanUsableForCycle = (workoutPlan: WorkoutPlan | null | undefined): boolean => {
  if (!workoutPlan?.days?.length) return false;

  const splitDays = Number(workoutPlan.splitDays);
  if (!Number.isFinite(splitDays) || splitDays <= 0) return false;

  return Boolean(toValidDate(workoutPlan.createdAt));
};

const hasAnyTrainingDayInPlan = (workoutPlan: WorkoutPlan | null | undefined): boolean => {
  if (!workoutPlan?.days?.length) return false;
  return workoutPlan.days.some((day) => !day.isRestDay);
};

const isPlannedRestDay = (
  date: Date,
  workoutPlan: WorkoutPlan,
  planDayMap: Map<string, boolean>,
): boolean => {
  const dayName = getCycleDayNameFromDate(date, workoutPlan);
  return Boolean(planDayMap.get(dayName));
};

const calculateStrictCalendarStreak = (
  completedDaySet: Set<string>,
  startDate: Date,
): number => {
  let streak = 0;
  let cursor = startDate;

  for (let idx = 0; idx < MAX_STREAK_LOOKBACK_DAYS; idx += 1) {
    if (!completedDaySet.has(toDateKey(cursor))) {
      break;
    }
    streak += 1;
    cursor = shiftDays(cursor, -1);
  }

  return streak;
};

const calculatePlanAwareConsistencyStreak = (
  completedDaySet: Set<string>,
  workoutPlan: WorkoutPlan,
  startDate: Date,
): number => {
  if (!hasAnyTrainingDayInPlan(workoutPlan)) {
    return 0;
  }

  const planDayMap = buildPlanDayMap(workoutPlan);

  let streak = 0;
  let cursor = startDate;

  for (let idx = 0; idx < MAX_STREAK_LOOKBACK_DAYS; idx += 1) {
    if (isPlannedRestDay(cursor, workoutPlan, planDayMap)) {
      cursor = shiftDays(cursor, -1);
      continue;
    }

    if (completedDaySet.has(toDateKey(cursor))) {
      streak += 1;
      cursor = shiftDays(cursor, -1);
      continue;
    }

    break;
  }

  return streak;
};

const calculateCurrentStreak = (
  workouts: WorkoutHistory[],
  workoutPlan?: WorkoutPlan | null,
): number => {
  const completedDaySet = buildCompletedDaySet(workouts);
  if (completedDaySet.size === 0) {
    return 0;
  }

  const today = startOfDay(new Date());
  const todayKey = toDateKey(today);
  const startDate = completedDaySet.has(todayKey) ? today : shiftDays(today, -1);

  if (!workoutPlan || !isPlanUsableForCycle(workoutPlan)) {
    return calculateStrictCalendarStreak(completedDaySet, startDate);
  }

  return calculatePlanAwareConsistencyStreak(completedDaySet, workoutPlan, startDate);
};

export const getHomeDerivedData = (
  workouts: WorkoutHistory[],
  workoutPlan?: WorkoutPlan | null,
): HomeDerivedData => {
  const today = startOfDay(new Date());

  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const weekWorkoutCounts: number[] = [0, 0, 0, 0, 0, 0, 0];
  const weekRestDays: boolean[] = [false, false, false, false, false, false, false];

  const nonRestWorkouts: WorkoutHistory[] = [];
  let totalDurationSeconds = 0;

  for (const workout of workouts) {
    const workoutDate = getDayStart(workout.date);
    if (!workoutDate) continue;

    const diffDays = Math.floor((workoutDate.getTime() - monday.getTime()) / DAY_IN_MS);
    const isCurrentWeek = diffDays >= 0 && diffDays < 7;

    if (workout.isRestDay) {
      if (isCurrentWeek) {
        weekRestDays[diffDays] = true;
      }
      continue;
    }

    nonRestWorkouts.push(workout);
    totalDurationSeconds += workout.duration || 0;

    if (isCurrentWeek) {
      weekWorkoutCounts[diffDays] += 1;
    }
  }

  if (workoutPlan && isPlanUsableForCycle(workoutPlan)) {
    const planDayMap = buildPlanDayMap(workoutPlan);
    // Pre-compute cycle day indices with workouts once (O(m))
    // instead of computing for every day in the week (avoiding O(7*m))
    const cycleDayIndicesWithWorkouts = getCycleDayIndicesWithWorkouts(
      workouts,
      workoutPlan,
    );

    for (let idx = 0; idx < 7; idx += 1) {
      const day = shiftDays(monday, idx);
      const hasWorkout = weekWorkoutCounts[idx] > 0;

      if (hasWorkout) {
        weekRestDays[idx] = false;
        continue;
      }

      const isPlanned = isPlannedRestDay(day, workoutPlan, planDayMap);
      const isAutoRest = shouldAutoConvertToRestDay(
        day,
        workoutPlan,
        cycleDayIndicesWithWorkouts,
      );

      if (isPlanned || isAutoRest) {
        weekRestDays[idx] = true;
      }
    }
  }

  const totalWorkouts = nonRestWorkouts.length;
  const totalHours = totalDurationSeconds / 3600;
  const totalHoursDisplay =
    totalHours >= 100
      ? Math.round(totalHours).toString()
      : Number(totalHours.toFixed(1)).toString();

  const currentStreak = calculateCurrentStreak(workouts, workoutPlan);
  const workoutDaysCount = weekWorkoutCounts.filter((count) => count > 0).length;

  return {
    nonRestWorkouts,
    quickStats: {
      totalWorkouts,
      totalHoursDisplay,
      currentStreak,
    },
    weekData: {
      days: weekWorkoutCounts,
      restDays: weekRestDays,
      workoutDaysCount,
    },
    recentWorkouts: nonRestWorkouts.slice(0, 3),
  };
};
