import { WorkoutHistory, WorkoutPlan } from "@/src/types/index";
import { DAY_IN_MS, startOfDay, toValidDate } from "@/src/utils/dateKey";

/**
 * Returns the 0-based cycle day index for a given date within the plan's split cycle.
 */
export const getCycleDayIndex = (
  date: Date,
  workoutPlan: WorkoutPlan | null | undefined,
): number => {
  if (!workoutPlan?.splitDays || !workoutPlan.createdAt) return 0;

  const planCreatedDate = toValidDate(workoutPlan.createdAt);
  const selectedDate = toValidDate(date);
  if (!planCreatedDate || !selectedDate) return 0;

  const splitDays = Math.floor(Number(workoutPlan.splitDays));
  if (!Number.isFinite(splitDays) || splitDays <= 0) return 0;

  const created = startOfDay(planCreatedDate).getTime();
  const target = startOfDay(selectedDate).getTime();
  const daysDifference = Math.floor((target - created) / DAY_IN_MS);

  return ((daysDifference % splitDays) + splitDays) % splitDays;
};

export const getCycleDayNameFromDate = (
  date: Date,
  workoutPlan: WorkoutPlan | null | undefined,
): string => {
  return `Day ${getCycleDayIndex(date, workoutPlan) + 1}`;
};

/**
 * Returns the cycle number (0-based) for a given date.
 * Cycle 0 = first cycle (plan creation through splitDays-1 days after).
 */
export const getCycleNumber = (
  date: Date,
  workoutPlan: WorkoutPlan | null | undefined,
): number => {
  if (!workoutPlan?.splitDays || !workoutPlan.createdAt) return 0;

  const planCreatedDate = toValidDate(workoutPlan.createdAt);
  const selectedDate = toValidDate(date);
  if (!planCreatedDate || !selectedDate) return 0;

  const splitDays = Math.floor(Number(workoutPlan.splitDays));
  if (!Number.isFinite(splitDays) || splitDays <= 0) return 0;

  const created = startOfDay(planCreatedDate).getTime();
  const target = startOfDay(selectedDate).getTime();
  const daysDifference = Math.floor((target - created) / DAY_IN_MS);
  if (daysDifference < 0) return 0;

  return Math.floor(daysDifference / splitDays);
};

export const isFirstCycle = (
  date: Date,
  workoutPlan: WorkoutPlan | null | undefined,
): boolean => getCycleNumber(date, workoutPlan) === 0;

/**
 * Finds the most recent successful workout for a given cycle day index,
 * searching backwards through all cycles before the target date.
 *
 * Handles missed workouts: if a workout was skipped in the previous cycle,
 * it falls back to the cycle before that, and so on.
 */
export const findLastSuccessfulWorkoutForCycleDay = (
  cycleDayIndex: number,
  targetDate: Date,
  workoutHistory: WorkoutHistory[],
  workoutPlan: WorkoutPlan,
): WorkoutHistory | null => {
  const targetTimestamp = startOfDay(targetDate).getTime();
  let bestWorkout: WorkoutHistory | null = null;
  let bestTimestamp = -1;

  for (const workout of workoutHistory) {
    if (workout.isRestDay) continue;
    if (!workout.exercises || workout.exercises.length === 0) continue;

    const workoutDate = toValidDate(workout.date);
    if (!workoutDate) continue;

    const workoutTimestamp = startOfDay(workoutDate).getTime();
    if (workoutTimestamp >= targetTimestamp) continue;

    if (getCycleDayIndex(workoutDate, workoutPlan) !== cycleDayIndex) continue;

    if (workoutTimestamp > bestTimestamp) {
      bestTimestamp = workoutTimestamp;
      bestWorkout = workout;
    }
  }

  return bestWorkout;
};

/**
 * Case 2: Determines if an empty plan day should be auto-converted to a rest day.
 *
 * Returns true when:
 * - Plan day has no exercises and is not explicitly marked as rest
 * - The date is past the first cycle
 * - No workout with exercises was ever logged for this cycle day position
 */
export const shouldAutoConvertToRestDay = (
  date: Date,
  workoutPlan: WorkoutPlan,
  workoutHistory: WorkoutHistory[],
): boolean => {
  if (!workoutPlan?.days?.length) return false;

  const cycleDayIndex = getCycleDayIndex(date, workoutPlan);
  const planDay = workoutPlan.days[cycleDayIndex];
  if (!planDay) return false;
  if (planDay.isRestDay) return false;
  if (planDay.exercises && planDay.exercises.length > 0) return false;

  // First cycle: don't auto-rest, show warning instead
  if (isFirstCycle(date, workoutPlan)) return false;

  // Check if any workout was ever logged for this cycle day position
  for (const workout of workoutHistory) {
    if (workout.isRestDay) continue;
    if (!workout.exercises || workout.exercises.length === 0) continue;
    const workoutDate = toValidDate(workout.date);
    if (!workoutDate) continue;
    if (getCycleDayIndex(workoutDate, workoutPlan) === cycleDayIndex) {
      return false;
    }
  }

  return true;
};

/**
 * Whether the given date is in the first cycle and corresponds to an empty plan day.
 * Used to show a warning: "If you don't add exercises, this becomes a rest day."
 */
export const isFirstCycleEmptyDay = (
  date: Date,
  workoutPlan: WorkoutPlan | null | undefined,
): boolean => {
  if (!workoutPlan?.days?.length) return false;
  if (!isFirstCycle(date, workoutPlan)) return false;

  const cycleDayIndex = getCycleDayIndex(date, workoutPlan);
  const planDay = workoutPlan.days[cycleDayIndex];
  if (!planDay) return false;
  if (planDay.isRestDay) return false;
  if (planDay.exercises && planDay.exercises.length > 0) return false;

  return true;
};
