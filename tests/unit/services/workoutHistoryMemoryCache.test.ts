import {
  clearWorkoutHistoryMemoryCache,
  getWorkoutHistoryMemoryCache,
  setWorkoutHistoryMemoryCache,
} from "@/src/services/workoutHistoryMemoryCache";
import { WorkoutHistory } from "@/src/types/index";

describe("workoutHistoryMemoryCache", () => {
  const mockUserId = "user-123";
  const mockWorkouts: WorkoutHistory[] = [
    {
      id: "workout-1",
      userID: mockUserId,
      date: "2026-06-06",
      duration: 3600,
      exercises: [],
    },
  ];

  beforeEach(() => {
    clearWorkoutHistoryMemoryCache();
  });

  it("should return null when getting a non-existent cache entry", () => {
    const cached = getWorkoutHistoryMemoryCache(mockUserId);
    expect(cached).toBeNull();
  });

  it("should store and retrieve workouts from the cache", () => {
    setWorkoutHistoryMemoryCache(mockUserId, mockWorkouts);

    const cached = getWorkoutHistoryMemoryCache(mockUserId);
    expect(cached).toEqual(mockWorkouts);
  });

  it("should return null and delete from cache if the entry is expired", () => {
    const initialTime = 1000000;
    const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(initialTime);

    setWorkoutHistoryMemoryCache(mockUserId, mockWorkouts);
    dateNowSpy.mockReturnValue(initialTime + 60_001);

    const cached = getWorkoutHistoryMemoryCache(mockUserId);
    expect(cached).toBeNull();
    dateNowSpy.mockReturnValue(initialTime);
    expect(getWorkoutHistoryMemoryCache(mockUserId)).toBeNull();

    dateNowSpy.mockRestore();
  });

  it("should return cached data if retrieved within custom maxAgeMs limit", () => {
    const initialTime = 1000000;
    const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(initialTime);

    setWorkoutHistoryMemoryCache(mockUserId, mockWorkouts);
    dateNowSpy.mockReturnValue(initialTime + 30_000);

    const cached = getWorkoutHistoryMemoryCache(mockUserId);
    expect(cached).toEqual(mockWorkouts);

    dateNowSpy.mockRestore();
  });

  it("should respect a custom maxAgeMs limit parameter", () => {
    const initialTime = 1000000;
    const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(initialTime);

    setWorkoutHistoryMemoryCache(mockUserId, mockWorkouts);
    dateNowSpy.mockReturnValue(initialTime + 10_000);

    const cached = getWorkoutHistoryMemoryCache(mockUserId, 5_000);
    expect(cached).toBeNull();

    dateNowSpy.mockRestore();
  });

  it("should clear cache for a specific user ID", () => {
    const otherUserId = "user-456";
    const otherWorkouts: WorkoutHistory[] = [
      {
        id: "workout-2",
        userID: otherUserId,
        date: "2026-06-05",
        duration: 1800,
        exercises: [],
      },
    ];

    setWorkoutHistoryMemoryCache(mockUserId, mockWorkouts);
    setWorkoutHistoryMemoryCache(otherUserId, otherWorkouts);

    clearWorkoutHistoryMemoryCache(mockUserId);

    expect(getWorkoutHistoryMemoryCache(mockUserId)).toBeNull();
    expect(getWorkoutHistoryMemoryCache(otherUserId)).toEqual(otherWorkouts);
  });

  it("should clear the entire cache when clearWorkoutHistoryMemoryCache is called without a user ID", () => {
    const otherUserId = "user-456";
    const otherWorkouts: WorkoutHistory[] = [
      {
        id: "workout-2",
        userID: otherUserId,
        date: "2026-06-05",
        duration: 1800,
        exercises: [],
      },
    ];

    setWorkoutHistoryMemoryCache(mockUserId, mockWorkouts);
    setWorkoutHistoryMemoryCache(otherUserId, otherWorkouts);

    clearWorkoutHistoryMemoryCache();

    expect(getWorkoutHistoryMemoryCache(mockUserId)).toBeNull();
    expect(getWorkoutHistoryMemoryCache(otherUserId)).toBeNull();
  });
});
