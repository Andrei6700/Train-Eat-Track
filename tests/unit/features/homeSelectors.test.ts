import { getHomeDerivedData } from "@/src/features/home/homeSelectors";
import { WorkoutHistory, WorkoutPlan } from "@/src/types/index";

// Pin "today" so week calculations are deterministic
// June 18, 2025 = Wednesday -> Monday = June 16
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2025, 5, 18, 12, 0, 0));
});

afterAll(() => {
  jest.useRealTimers();
});

const makeWorkout = (
  dateStr: string,
  durationSec: number,
  exerciseName = "Bench Press",
  isRestDay = false,
): WorkoutHistory => ({
  date: new Date(dateStr),
  duration: durationSec,
  exercises: isRestDay
    ? []
    : [{ exerciseName, sets: [{ reps: 10, weight: 60, weightUnit: "kg" as const }] }],
  isRestDay,
});

describe("getHomeDerivedData", () => {
  describe("with empty workouts", () => {
    it("should return zero stats", () => {
      const result = getHomeDerivedData([]);
      expect(result.nonRestWorkouts).toHaveLength(0);
      expect(result.quickStats.totalWorkouts).toBe(0);
      expect(result.quickStats.totalHoursDisplay).toBe("0");
      expect(result.quickStats.currentStreak).toBe(0);
      expect(result.weekData.workoutDaysCount).toBe(0);
      expect(result.recentWorkouts).toHaveLength(0);
    });

    it("should initialize week arrays to zeros/false", () => {
      const result = getHomeDerivedData([]);
      expect(result.weekData.days).toEqual([0, 0, 0, 0, 0, 0, 0]);
      expect(result.weekData.restDays).toEqual([false, false, false, false, false, false, false]);
    });
  });

  describe("nonRestWorkouts filtering", () => {
    it("should exclude rest day workouts", () => {
      const workouts = [
        makeWorkout("2025-06-16", 3600),
        makeWorkout("2025-06-17", 0, "Rest", true),
        makeWorkout("2025-06-18", 3600),
      ];
      const result = getHomeDerivedData(workouts);
      expect(result.nonRestWorkouts).toHaveLength(2);
    });
  });

  describe("quickStats", () => {
    it("should count total non-rest workouts", () => {
      const workouts = [
        makeWorkout("2025-06-01", 3600),
        makeWorkout("2025-06-02", 3600),
        makeWorkout("2025-06-03", 0, "Rest", true),
      ];
      const result = getHomeDerivedData(workouts);
      expect(result.quickStats.totalWorkouts).toBe(2);
    });

    it("should display hours with one decimal for < 100h", () => {
      // 2 workouts × 3600s = 7200s = 2 hours
      const workouts = [
        makeWorkout("2025-06-01", 3600),
        makeWorkout("2025-06-02", 3600),
      ];
      const result = getHomeDerivedData(workouts);
      expect(result.quickStats.totalHoursDisplay).toBe("2");
    });

    it("should display hours as integer for >= 100h", () => {
      // 360001s ≈ 100.0003h
      const workouts = [makeWorkout("2025-06-01", 360001)];
      const result = getHomeDerivedData(workouts);
      expect(result.quickStats.totalHoursDisplay).toBe("100");
    });
  });

  describe("weekData", () => {
    it("should count workouts on correct day indices for the current week", () => {
      // Today is Wed Jun 18. Week is Mon(0)-Sun(6).
      // Mon Jun 16 = index 0, Tue Jun 17 = index 1, Wed Jun 18 = index 2
      const workouts = [
        makeWorkout("2025-06-16", 3600), // Monday
        makeWorkout("2025-06-18", 3600), // Wednesday
      ];
      const result = getHomeDerivedData(workouts);
      expect(result.weekData.days[0]).toBe(1); // Monday
      expect(result.weekData.days[1]).toBe(0); // Tuesday
      expect(result.weekData.days[2]).toBe(1); // Wednesday
      expect(result.weekData.workoutDaysCount).toBe(2);
    });

    it("should mark rest days in the current week", () => {
      const workouts = [
        makeWorkout("2025-06-17", 0, "Rest", true), // Tuesday rest
      ];
      const result = getHomeDerivedData(workouts);
      expect(result.weekData.restDays[1]).toBe(true); // Tuesday
    });

    it("should not count workouts from other weeks", () => {
      const workouts = [
        makeWorkout("2025-06-10", 3600), // Previous week
      ];
      const result = getHomeDerivedData(workouts);
      expect(result.weekData.workoutDaysCount).toBe(0);
    });
  });

  describe("recentWorkouts", () => {
    it("should limit to 3 most recent non-rest workouts", () => {
      const workouts = [
        makeWorkout("2025-06-01", 3600, "A"),
        makeWorkout("2025-06-02", 3600, "B"),
        makeWorkout("2025-06-03", 3600, "C"),
        makeWorkout("2025-06-04", 3600, "D"),
        makeWorkout("2025-06-05", 3600, "E"),
      ];
      const result = getHomeDerivedData(workouts);
      expect(result.recentWorkouts).toHaveLength(3);
    });

    it("should return all when fewer than 3 non-rest workouts", () => {
      const workouts = [makeWorkout("2025-06-01", 3600)];
      const result = getHomeDerivedData(workouts);
      expect(result.recentWorkouts).toHaveLength(1);
    });
  });

  describe("currentStreak", () => {
    it("should be 0 with no workouts", () => {
      const result = getHomeDerivedData([]);
      expect(result.quickStats.currentStreak).toBe(0);
    });

    it("should count consecutive days from today/yesterday", () => {
      // Today = June 18. Workouts on Jun 17, Jun 18 -> streak of 2.
      const workouts = [
        makeWorkout("2025-06-17", 3600),
        makeWorkout("2025-06-18", 3600),
      ];
      const result = getHomeDerivedData(workouts);
      expect(result.quickStats.currentStreak).toBe(2);
    });

    it("should start from yesterday if no workout today", () => {
      // Today = June 18, workout on Jun 17 only -> streak of 1
      const workouts = [makeWorkout("2025-06-17", 3600)];
      const result = getHomeDerivedData(workouts);
      expect(result.quickStats.currentStreak).toBe(1);
    });

    it("should break on gaps", () => {
      // Today = June 18. Workout on Jun 18 and Jun 16 (gap on Jun 17) -> streak 1
      const workouts = [
        makeWorkout("2025-06-16", 3600),
        makeWorkout("2025-06-18", 3600),
      ];
      const result = getHomeDerivedData(workouts);
      expect(result.quickStats.currentStreak).toBe(1);
    });
  });

  describe("with workout plan (plan-aware streak)", () => {
    const plan: WorkoutPlan = {
      planName: "PPL",
      splitDays: 7,
      createdAt: new Date("2025-06-01"),
      updatedAt: new Date("2025-06-01"),
      days: [
        { day: "Day 1", isRestDay: false, exercises: [{ exerciseName: "Push", sets: [{ reps: 10, weight: 60, weightUnit: "kg" }] }] },
        { day: "Day 2", isRestDay: false, exercises: [{ exerciseName: "Pull", sets: [{ reps: 10, weight: 60, weightUnit: "kg" }] }] },
        { day: "Day 3", isRestDay: false, exercises: [{ exerciseName: "Legs", sets: [{ reps: 10, weight: 60, weightUnit: "kg" }] }] },
        { day: "Day 4", isRestDay: true, exercises: [] },
        { day: "Day 5", isRestDay: false, exercises: [{ exerciseName: "Push", sets: [{ reps: 10, weight: 60, weightUnit: "kg" }] }] },
        { day: "Day 6", isRestDay: false, exercises: [{ exerciseName: "Pull", sets: [{ reps: 10, weight: 60, weightUnit: "kg" }] }] },
        { day: "Day 7", isRestDay: true, exercises: [] },
      ],
    };

    it("should skip planned rest days in streak calculation", () => {
      // Today = Jun 18 (Wed) = Day 4 of cycle 2 (split starts Jun 1).
      // Cycle day index for Jun 18: (18-1) % 7 = 3 -> Day 4 -> rest day in plan.
      // Jun 17 = cycle day 2 (training day) -> workout exists -> counts.
      // Jun 16 = cycle day 1 (training day) -> workout exists -> counts.
      // Jun 15 = cycle day 0 (training day) -> workout exists -> counts.
      const workouts = [
        makeWorkout("2025-06-15", 3600),
        makeWorkout("2025-06-16", 3600),
        makeWorkout("2025-06-17", 3600),
      ];
      const result = getHomeDerivedData(workouts, plan);
      // Streak should count through rest days: 3+ depending on how far back
      expect(result.quickStats.currentStreak).toBeGreaterThanOrEqual(3);
    });
  });
});
