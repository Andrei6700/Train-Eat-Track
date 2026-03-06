import { WorkoutPlan } from "@/src/types/index";
import { DAY_IN_MS, startOfDay, toValidDate } from "@/src/utils/dateKey";

export const getCycleDayNameFromDate = (
  date: Date,
  workoutPlan: WorkoutPlan | null | undefined,
): string => {
  if (!workoutPlan || !workoutPlan.splitDays || !workoutPlan.createdAt) {
    return "Day 1";
  }

  const planCreatedDate = toValidDate(workoutPlan.createdAt);
  const selectedDate = toValidDate(date);
  if (!planCreatedDate || !selectedDate) {
    return "Day 1";
  }

  const splitDays = Number(workoutPlan.splitDays);
  if (!Number.isFinite(splitDays) || splitDays <= 0) {
    return "Day 1";
  }

  const created = startOfDay(planCreatedDate).getTime();
  const target = startOfDay(selectedDate).getTime();
  const daysDifference = Math.floor((target - created) / DAY_IN_MS);
  const normalizedSplitDays = Math.floor(splitDays);
  const dayIndex =
    ((daysDifference % normalizedSplitDays) + normalizedSplitDays) %
    normalizedSplitDays;

  return `Day ${dayIndex + 1}`;
};
