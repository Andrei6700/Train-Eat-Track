import { WorkoutHistory, WorkoutPlan } from "@/src/types/index";
import {
  getCycleDayIndex,
  getCycleDayNameFromDate,
  getCycleNumber,
  isFirstCycle,
  findLastSuccessfulWorkoutForCycleDay,
  getCycleDayIndicesWithWorkouts,
  shouldAutoConvertToRestDay,
  isFirstCycleEmptyDay,
} from "@/src/utils/workoutPlanCycle";

// Helper to build a minimal WorkoutPlan
const makePlan = (
  overrides: Partial<WorkoutPlan> = {},
): WorkoutPlan => ({
  planName: "Test Plan",
  splitDays: 7,
  days: [],
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
  ...overrides,
});

describe("getCycleDayIndex", () => {
  it("should return 0 when plan is null", () => {
    expect(getCycleDayIndex(new Date(), null)).toBe(0);
  });

  it("should return 0 when plan is undefined", () => {
    expect(getCycleDayIndex(new Date(), undefined)).toBe(0);
  });

  it("should return 0 when splitDays is missing", () => {
    const plan = makePlan({ splitDays: undefined });
    expect(getCycleDayIndex(new Date(), plan)).toBe(0);
  });

  it("should return 0 on the plan creation date", () => {
    const plan = makePlan({ createdAt: new Date("2025-06-01") });
    expect(getCycleDayIndex(new Date("2025-06-01"), plan)).toBe(0);
  });

  it("should return correct index within the first cycle", () => {
    const plan = makePlan({ splitDays: 7, createdAt: new Date("2025-06-01") });
    expect(getCycleDayIndex(new Date("2025-06-04"), plan)).toBe(3);
  });

  it("should wrap around after splitDays", () => {
    const plan = makePlan({ splitDays: 7, createdAt: new Date("2025-06-01") });
    // Day 8 = index 1 (wraps)
    expect(getCycleDayIndex(new Date("2025-06-08"), plan)).toBe(0);
    expect(getCycleDayIndex(new Date("2025-06-09"), plan)).toBe(1);
  });

  it("should handle dates before plan creation (negative diff)", () => {
    const plan = makePlan({ splitDays: 4, createdAt: new Date("2025-06-10") });
    // 2 days before = -2 mod 4 = 2 (via double-modulo trick)
    const result = getCycleDayIndex(new Date("2025-06-08"), plan);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(4);
  });

  it("should return 0 when splitDays is 0", () => {
    const plan = makePlan({ splitDays: 0 });
    expect(getCycleDayIndex(new Date(), plan)).toBe(0);
  });

  it("should return 0 when splitDays is negative", () => {
    const plan = makePlan({ splitDays: -3 });
    expect(getCycleDayIndex(new Date(), plan)).toBe(0);
  });
});

describe("getCycleDayNameFromDate", () => {
  it("should return 'Day 1' on plan creation date", () => {
    const plan = makePlan({ createdAt: new Date("2025-06-01") });
    expect(getCycleDayNameFromDate(new Date("2025-06-01"), plan)).toBe("Day 1");
  });

  it("should return 'Day 4' on the 4th day", () => {
    const plan = makePlan({ splitDays: 7, createdAt: new Date("2025-06-01") });
    expect(getCycleDayNameFromDate(new Date("2025-06-04"), plan)).toBe("Day 4");
  });
});

describe("getCycleNumber", () => {
  it("should return 0 for null plan", () => {
    expect(getCycleNumber(new Date(), null)).toBe(0);
  });

  it("should return 0 on creation date (first cycle)", () => {
    const plan = makePlan({ splitDays: 7, createdAt: new Date("2025-06-01") });
    expect(getCycleNumber(new Date("2025-06-01"), plan)).toBe(0);
  });

  it("should return 1 on the first day of the second cycle", () => {
    const plan = makePlan({ splitDays: 7, createdAt: new Date("2025-06-01") });
    expect(getCycleNumber(new Date("2025-06-08"), plan)).toBe(1);
  });

  it("should return 0 for dates before plan creation", () => {
    const plan = makePlan({ splitDays: 7, createdAt: new Date("2025-06-10") });
    expect(getCycleNumber(new Date("2025-06-01"), plan)).toBe(0);
  });
});

describe("isFirstCycle", () => {
  it("should return true on creation date", () => {
    const plan = makePlan({ splitDays: 7, createdAt: new Date("2025-06-01") });
    expect(isFirstCycle(new Date("2025-06-01"), plan)).toBe(true);
  });

  it("should return true on last day of first cycle", () => {
    const plan = makePlan({ splitDays: 7, createdAt: new Date("2025-06-01") });
    expect(isFirstCycle(new Date("2025-06-07"), plan)).toBe(true);
  });

  it("should return false on first day of second cycle", () => {
    const plan = makePlan({ splitDays: 7, createdAt: new Date("2025-06-01") });
    expect(isFirstCycle(new Date("2025-06-08"), plan)).toBe(false);
  });
});

describe("findLastSuccessfulWorkoutForCycleDay", () => {
  const plan = makePlan({ splitDays: 7, createdAt: new Date("2025-06-01") });

  it("should return null for empty history", () => {
    const result = findLastSuccessfulWorkoutForCycleDay(
      0,
      new Date("2025-06-15"),
      [],
      plan,
    );
    expect(result).toBeNull();
  });

  it("should return null when no matching cycle day exists", () => {
    const workouts: WorkoutHistory[] = [
      {
        date: new Date("2025-06-02"), // cycle day 1
        duration: 3600,
        exercises: [{ exerciseName: "Bench", sets: [{ reps: 10, weight: 60, weightUnit: "kg" }] }],
      },
    ];
    // Looking for cycle day 3
    const result = findLastSuccessfulWorkoutForCycleDay(3, new Date("2025-06-15"), workouts, plan);
    expect(result).toBeNull();
  });

  it("should return the most recent matching workout", () => {
    const workouts: WorkoutHistory[] = [
      {
        date: new Date("2025-06-01"), // cycle day 0
        duration: 3000,
        exercises: [{ exerciseName: "Squat", sets: [{ reps: 5, weight: 100, weightUnit: "kg" }] }],
      },
      {
        date: new Date("2025-06-08"), // cycle day 0 (second cycle)
        duration: 3200,
        exercises: [{ exerciseName: "Squat", sets: [{ reps: 5, weight: 105, weightUnit: "kg" }] }],
      },
    ];
    const result = findLastSuccessfulWorkoutForCycleDay(0, new Date("2025-06-15"), workouts, plan);
    expect(result).toBe(workouts[1]);
  });

  it("should skip rest-day workouts", () => {
    const workouts: WorkoutHistory[] = [
      {
        date: new Date("2025-06-01"),
        duration: 0,
        exercises: [],
        isRestDay: true,
      },
    ];
    const result = findLastSuccessfulWorkoutForCycleDay(0, new Date("2025-06-15"), workouts, plan);
    expect(result).toBeNull();
  });

  it("should skip workouts with no exercises", () => {
    const workouts: WorkoutHistory[] = [
      {
        date: new Date("2025-06-01"),
        duration: 1000,
        exercises: [],
      },
    ];
    const result = findLastSuccessfulWorkoutForCycleDay(0, new Date("2025-06-15"), workouts, plan);
    expect(result).toBeNull();
  });
});

describe("getCycleDayIndicesWithWorkouts", () => {
  const plan = makePlan({ splitDays: 7, createdAt: new Date("2025-06-01") });

  it("should return empty set for null plan", () => {
    const result = getCycleDayIndicesWithWorkouts([], null);
    expect(result.size).toBe(0);
  });

  it("should return empty set for no workouts", () => {
    const result = getCycleDayIndicesWithWorkouts([], plan);
    expect(result.size).toBe(0);
  });

  it("should include cycle day indices of valid workouts", () => {
    const workouts: WorkoutHistory[] = [
      {
        date: new Date("2025-06-01"), // day 0
        duration: 3600,
        exercises: [{ exerciseName: "A", sets: [{ reps: 10, weight: 50, weightUnit: "kg" }] }],
      },
      {
        date: new Date("2025-06-03"), // day 2
        duration: 3600,
        exercises: [{ exerciseName: "B", sets: [{ reps: 10, weight: 50, weightUnit: "kg" }] }],
      },
    ];
    const result = getCycleDayIndicesWithWorkouts(workouts, plan);
    expect(result.has(0)).toBe(true);
    expect(result.has(2)).toBe(true);
    expect(result.has(1)).toBe(false);
  });

  it("should skip rest-day workouts", () => {
    const workouts: WorkoutHistory[] = [
      {
        date: new Date("2025-06-01"),
        duration: 0,
        exercises: [{ exerciseName: "A", sets: [{ reps: 10, weight: 50, weightUnit: "kg" }] }],
        isRestDay: true,
      },
    ];
    const result = getCycleDayIndicesWithWorkouts(workouts, plan);
    expect(result.size).toBe(0);
  });
});

describe("shouldAutoConvertToRestDay", () => {
  it("should return false when plan has no days", () => {
    const plan = makePlan({ days: [] });
    const result = shouldAutoConvertToRestDay(new Date(), plan, new Set());
    expect(result).toBe(false);
  });

  it("should return false for rest days in the plan", () => {
    const plan = makePlan({
      splitDays: 2,
      createdAt: new Date("2025-06-01"),
      days: [
        { day: "Day 1", isRestDay: true, exercises: [] },
        { day: "Day 2", isRestDay: false, exercises: [] },
      ],
    });
    // Day 0 = rest day in plan
    const result = shouldAutoConvertToRestDay(new Date("2025-06-01"), plan, new Set());
    expect(result).toBe(false);
  });

  it("should return false during the first cycle", () => {
    const plan = makePlan({
      splitDays: 7,
      createdAt: new Date("2025-06-01"),
      days: [
        { day: "Day 1", isRestDay: false, exercises: [] },
        { day: "Day 2", isRestDay: false, exercises: [] },
        { day: "Day 3", isRestDay: false, exercises: [] },
        { day: "Day 4", isRestDay: false, exercises: [] },
        { day: "Day 5", isRestDay: false, exercises: [] },
        { day: "Day 6", isRestDay: false, exercises: [] },
        { day: "Day 7", isRestDay: false, exercises: [] },
      ],
    });
    const result = shouldAutoConvertToRestDay(new Date("2025-06-03"), plan, new Set());
    expect(result).toBe(false);
  });

  it("should return true for empty day in second cycle with no prior workouts on that cycle day", () => {
    const plan = makePlan({
      splitDays: 7,
      createdAt: new Date("2025-06-01"),
      days: [
        { day: "Day 1", isRestDay: false, exercises: [] },
        { day: "Day 2", isRestDay: false, exercises: [] },
        { day: "Day 3", isRestDay: false, exercises: [] },
        { day: "Day 4", isRestDay: false, exercises: [] },
        { day: "Day 5", isRestDay: false, exercises: [] },
        { day: "Day 6", isRestDay: false, exercises: [] },
        { day: "Day 7", isRestDay: false, exercises: [] },
      ],
    });
    // June 8 = second cycle, day index 0
    const result = shouldAutoConvertToRestDay(new Date("2025-06-08"), plan, new Set());
    expect(result).toBe(true);
  });

  it("should return false if cycle day has prior workouts", () => {
    const plan = makePlan({
      splitDays: 7,
      createdAt: new Date("2025-06-01"),
      days: [
        { day: "Day 1", isRestDay: false, exercises: [] },
        { day: "Day 2", isRestDay: false, exercises: [] },
        { day: "Day 3", isRestDay: false, exercises: [] },
        { day: "Day 4", isRestDay: false, exercises: [] },
        { day: "Day 5", isRestDay: false, exercises: [] },
        { day: "Day 6", isRestDay: false, exercises: [] },
        { day: "Day 7", isRestDay: false, exercises: [] },
      ],
    });
    // Cycle day 0 has workouts
    const result = shouldAutoConvertToRestDay(new Date("2025-06-08"), plan, new Set([0]));
    expect(result).toBe(false);
  });
});

describe("isFirstCycleEmptyDay", () => {
  it("should return false for null plan", () => {
    expect(isFirstCycleEmptyDay(new Date(), null)).toBe(false);
  });

  it("should return false when not in first cycle", () => {
    const plan = makePlan({
      splitDays: 7,
      createdAt: new Date("2025-06-01"),
      days: [{ day: "Day 1", isRestDay: false, exercises: [] }],
    });
    expect(isFirstCycleEmptyDay(new Date("2025-06-10"), plan)).toBe(false);
  });

  it("should return true for empty non-rest day in first cycle", () => {
    const plan = makePlan({
      splitDays: 7,
      createdAt: new Date("2025-06-01"),
      days: [
        { day: "Day 1", isRestDay: false, exercises: [] },
        { day: "Day 2", isRestDay: false, exercises: [] },
        { day: "Day 3", isRestDay: false, exercises: [] },
        { day: "Day 4", isRestDay: false, exercises: [] },
        { day: "Day 5", isRestDay: false, exercises: [] },
        { day: "Day 6", isRestDay: false, exercises: [] },
        { day: "Day 7", isRestDay: false, exercises: [] },
      ],
    });
    expect(isFirstCycleEmptyDay(new Date("2025-06-01"), plan)).toBe(true);
  });

  it("should return false for rest day in first cycle", () => {
    const plan = makePlan({
      splitDays: 2,
      createdAt: new Date("2025-06-01"),
      days: [
        { day: "Day 1", isRestDay: true, exercises: [] },
        { day: "Day 2", isRestDay: false, exercises: [] },
      ],
    });
    expect(isFirstCycleEmptyDay(new Date("2025-06-01"), plan)).toBe(false);
  });

  it("should return false for day with exercises in first cycle", () => {
    const plan = makePlan({
      splitDays: 2,
      createdAt: new Date("2025-06-01"),
      days: [
        {
          day: "Day 1",
          isRestDay: false,
          exercises: [{ exerciseName: "Bench", sets: [{ reps: 10, weight: 60, weightUnit: "kg" }] }],
        },
        { day: "Day 2", isRestDay: false, exercises: [] },
      ],
    });
    expect(isFirstCycleEmptyDay(new Date("2025-06-01"), plan)).toBe(false);
  });
});
