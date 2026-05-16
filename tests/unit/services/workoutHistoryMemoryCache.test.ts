import {
  getWorkoutHistoryMemoryCache,
  setWorkoutHistoryMemoryCache,
  clearWorkoutHistoryMemoryCache,
} from "@/src/services/workoutHistoryMemoryCache";
import { WorkoutHistory } from "@/src/types/index";

const makeWorkout = (name: string): WorkoutHistory => ({
  date: new Date("2025-06-15"),
  duration: 3600,
  exercises: [
    { exerciseName: name, sets: [{ reps: 10, weight: 50, weightUnit: "kg" }] },
  ],
});

describe("workoutHistoryMemoryCache", () => {
  beforeEach(() => {
    clearWorkoutHistoryMemoryCache();
  });

  describe("getWorkoutHistoryMemoryCache", () => {
    it("should return null for unknown user", () => {
      expect(getWorkoutHistoryMemoryCache("unknown-user")).toBeNull();
    });

    it("should return cached data within default TTL", () => {
      const workouts = [makeWorkout("Bench")];
      setWorkoutHistoryMemoryCache("user1", workouts);
      const result = getWorkoutHistoryMemoryCache("user1");
      expect(result).toEqual(workouts);
    });

    it("should return null after TTL expires", () => {
      const workouts = [makeWorkout("Bench")];
      setWorkoutHistoryMemoryCache("user1", workouts);

      // Advance time past default TTL (60s)
      const realNow = Date.now;
      Date.now = () => realNow() + 61_000;

      expect(getWorkoutHistoryMemoryCache("user1")).toBeNull();

      Date.now = realNow;
    });

    it("should return data within custom maxAgeMs", () => {
      const workouts = [makeWorkout("Squat")];
      setWorkoutHistoryMemoryCache("user1", workouts);

      const realNow = Date.now;
      Date.now = () => realNow() + 5_000;

      expect(getWorkoutHistoryMemoryCache("user1", 10_000)).toEqual(workouts);

      Date.now = realNow;
    });

    it("should return null when custom maxAgeMs exceeded", () => {
      const workouts = [makeWorkout("Squat")];
      setWorkoutHistoryMemoryCache("user1", workouts);

      const realNow = Date.now;
      Date.now = () => realNow() + 5_000;

      expect(getWorkoutHistoryMemoryCache("user1", 3_000)).toBeNull();

      Date.now = realNow;
    });
  });

  describe("setWorkoutHistoryMemoryCache", () => {
    it("should store workouts for a user", () => {
      const workouts = [makeWorkout("Deadlift")];
      setWorkoutHistoryMemoryCache("user1", workouts);
      expect(getWorkoutHistoryMemoryCache("user1")).toEqual(workouts);
    });

    it("should overwrite previous cache for same user", () => {
      setWorkoutHistoryMemoryCache("user1", [makeWorkout("Old")]);
      const newWorkouts = [makeWorkout("New")];
      setWorkoutHistoryMemoryCache("user1", newWorkouts);
      expect(getWorkoutHistoryMemoryCache("user1")).toEqual(newWorkouts);
    });

    it("should isolate data between users", () => {
      const w1 = [makeWorkout("User1 Exercise")];
      const w2 = [makeWorkout("User2 Exercise")];
      setWorkoutHistoryMemoryCache("user1", w1);
      setWorkoutHistoryMemoryCache("user2", w2);
      expect(getWorkoutHistoryMemoryCache("user1")).toEqual(w1);
      expect(getWorkoutHistoryMemoryCache("user2")).toEqual(w2);
    });
  });

  describe("clearWorkoutHistoryMemoryCache", () => {
    it("should clear all users when no userId provided", () => {
      setWorkoutHistoryMemoryCache("user1", [makeWorkout("A")]);
      setWorkoutHistoryMemoryCache("user2", [makeWorkout("B")]);
      clearWorkoutHistoryMemoryCache();
      expect(getWorkoutHistoryMemoryCache("user1")).toBeNull();
      expect(getWorkoutHistoryMemoryCache("user2")).toBeNull();
    });

    it("should clear only the specified user", () => {
      setWorkoutHistoryMemoryCache("user1", [makeWorkout("A")]);
      setWorkoutHistoryMemoryCache("user2", [makeWorkout("B")]);
      clearWorkoutHistoryMemoryCache("user1");
      expect(getWorkoutHistoryMemoryCache("user1")).toBeNull();
      expect(getWorkoutHistoryMemoryCache("user2")).not.toBeNull();
    });
  });
});
