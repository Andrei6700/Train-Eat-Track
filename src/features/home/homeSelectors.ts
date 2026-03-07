import { WorkoutHistory } from "@/src/types/index";

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

const DAY_IN_MS = 1000 * 60 * 60 * 24;

const getDayStart = (value: Date | string): Date => {
  const parsedDate = new Date(value);
  parsedDate.setHours(0, 0, 0, 0);
  return parsedDate;
};

const calculateCurrentStreak = (nonRestWorkouts: WorkoutHistory[]): number => {
  if (nonRestWorkouts.length === 0) {
    return 0;
  }

  const sortedWorkouts = [...nonRestWorkouts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  for (const workout of sortedWorkouts) {
    const workoutDate = getDayStart(workout.date);
    const diffDays = Math.floor((currentDate.getTime() - workoutDate.getTime()) / DAY_IN_MS);

    if (diffDays === streak) {
      streak++;
      currentDate = workoutDate;
    } else if (diffDays === streak + 1) {
      // Allow one day gap to match the previous behavior.
      streak++;
      currentDate = workoutDate;
    } else {
      break;
    }
  }

  return streak;
};

export const getHomeDerivedData = (workouts: WorkoutHistory[]): HomeDerivedData => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const weekWorkoutCounts: number[] = [0, 0, 0, 0, 0, 0, 0];
  const weekRestDays: boolean[] = [false, false, false, false, false, false, false];

  const nonRestWorkouts: WorkoutHistory[] = [];
  let totalDurationSeconds = 0;

  for (const workout of workouts) {
    const workoutDate = getDayStart(workout.date);
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
      weekWorkoutCounts[diffDays]++;
    }
  }

  const totalWorkouts = nonRestWorkouts.length;
  const totalHours = totalDurationSeconds / 3600;
  const totalHoursDisplay =
    totalHours >= 100
      ? Math.round(totalHours).toString()
      : Number(totalHours.toFixed(1)).toString();

  const currentStreak = calculateCurrentStreak(nonRestWorkouts);
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
