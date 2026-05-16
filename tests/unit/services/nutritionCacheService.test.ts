// Mock the transitive Firebase dependency chain:
// nutritionCacheService → nutritionService → firebase config
jest.mock("@/src/config/firebase", () => ({
  firestore: {},
}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(),
  Timestamp: { fromDate: jest.fn() },
}));
jest.mock("@/src/services/nutritionCalendarCacheService", () => ({
  getCachedNutritionCalendarSummary: jest.fn(),
  setCachedNutritionCalendarSummary: jest.fn(),
}));

import {
  getNutritionMemoryCache,
  setNutritionMemoryCache,
  invalidateNutritionMemoryDay,
  clearNutritionMemoryCache,
  shouldPreloadNutritionWeek,
  markNutritionWeekPreloaded,
  NUTRITION_MEMORY_DAY_TTL_MS,
  NUTRITION_WEEK_PRELOAD_COOLDOWN_MS,
} from "@/src/services/nutritionCacheService";
import { DailyNutrition } from "@/src/types/index";

const makeNutrition = (overrides: Partial<DailyNutrition> = {}): DailyNutrition => ({
  date: new Date("2025-06-15"),
  calorieGoal: 2500,
  proteinGoal: 180,
  carbsGoal: 250,
  fatGoal: 80,
  meals: [],
  ...overrides,
});

describe("nutritionCacheService", () => {
  const userId = "test-user";
  const date = new Date("2025-06-15");

  beforeEach(() => {
    clearNutritionMemoryCache();
  });

  describe("getNutritionMemoryCache", () => {
    it("should return null data for cache miss", () => {
      const result = getNutritionMemoryCache(userId, date);
      expect(result.data).toBeNull();
      expect(result.isFresh).toBe(false);
    });

    it("should return fresh data after set", () => {
      const nutrition = makeNutrition();
      setNutritionMemoryCache(userId, date, nutrition);
      const result = getNutritionMemoryCache(userId, date);
      expect(result.data).not.toBeNull();
      expect(result.isFresh).toBe(true);
      expect(result.data!.calorieGoal).toBe(2500);
    });

    it("should return stale data when allowStale is true and TTL expired", () => {
      const nutrition = makeNutrition();
      setNutritionMemoryCache(userId, date, nutrition);

      const realNow = Date.now;
      Date.now = () => realNow() + NUTRITION_MEMORY_DAY_TTL_MS + 1000;

      const result = getNutritionMemoryCache(userId, date, { allowStale: true });
      expect(result.data).not.toBeNull();
      expect(result.isFresh).toBe(false);

      Date.now = realNow;
    });

    it("should return null data when stale and allowStale is false", () => {
      const nutrition = makeNutrition();
      setNutritionMemoryCache(userId, date, nutrition);

      const realNow = Date.now;
      Date.now = () => realNow() + NUTRITION_MEMORY_DAY_TTL_MS + 1000;

      const result = getNutritionMemoryCache(userId, date);
      expect(result.data).toBeNull();
      expect(result.isFresh).toBe(false);

      Date.now = realNow;
    });

    it("should return cloned data (not same reference)", () => {
      const nutrition = makeNutrition({ meals: [{ mealName: "Lunch", foods: [] }] });
      setNutritionMemoryCache(userId, date, nutrition);
      const r1 = getNutritionMemoryCache(userId, date);
      const r2 = getNutritionMemoryCache(userId, date);
      expect(r1.data).not.toBe(r2.data);
    });
  });

  describe("setNutritionMemoryCache", () => {
    it("should return written:true for new entry", () => {
      const result = setNutritionMemoryCache(userId, date, makeNutrition());
      expect(result.written).toBe(true);
      expect(result.touched).toBe(false);
    });

    it("should return touched:true when writing identical data", () => {
      const nutrition = makeNutrition();
      setNutritionMemoryCache(userId, date, nutrition);
      const result = setNutritionMemoryCache(userId, date, nutrition);
      expect(result.written).toBe(false);
      expect(result.touched).toBe(true);
    });

    it("should return written:true when data changes", () => {
      setNutritionMemoryCache(userId, date, makeNutrition({ calorieGoal: 2500 }));
      const result = setNutritionMemoryCache(userId, date, makeNutrition({ calorieGoal: 3000 }));
      expect(result.written).toBe(true);
    });
  });

  describe("invalidateNutritionMemoryDay", () => {
    it("should remove a specific day from cache", () => {
      setNutritionMemoryCache(userId, date, makeNutrition());
      invalidateNutritionMemoryDay(userId, date);
      const result = getNutritionMemoryCache(userId, date);
      expect(result.data).toBeNull();
    });

    it("should not affect other dates", () => {
      const otherDate = new Date("2025-06-16");
      setNutritionMemoryCache(userId, date, makeNutrition());
      setNutritionMemoryCache(userId, otherDate, makeNutrition());
      invalidateNutritionMemoryDay(userId, date);
      expect(getNutritionMemoryCache(userId, otherDate).data).not.toBeNull();
    });
  });

  describe("clearNutritionMemoryCache", () => {
    it("should clear all entries when no userId", () => {
      setNutritionMemoryCache("user1", date, makeNutrition());
      setNutritionMemoryCache("user2", date, makeNutrition());
      clearNutritionMemoryCache();
      expect(getNutritionMemoryCache("user1", date).data).toBeNull();
      expect(getNutritionMemoryCache("user2", date).data).toBeNull();
    });

    it("should clear only specified user entries", () => {
      setNutritionMemoryCache("user1", date, makeNutrition());
      setNutritionMemoryCache("user2", date, makeNutrition());
      clearNutritionMemoryCache("user1");
      expect(getNutritionMemoryCache("user1", date).data).toBeNull();
      expect(getNutritionMemoryCache("user2", date).data).not.toBeNull();
    });
  });

  describe("shouldPreloadNutritionWeek", () => {
    it("should return true when no preload has been recorded", () => {
      expect(shouldPreloadNutritionWeek(userId)).toBe(true);
    });

    it("should return false within cooldown period", () => {
      markNutritionWeekPreloaded(userId);
      expect(shouldPreloadNutritionWeek(userId)).toBe(false);
    });

    it("should return true after cooldown expires", () => {
      markNutritionWeekPreloaded(userId);

      const realNow = Date.now;
      Date.now = () => realNow() + NUTRITION_WEEK_PRELOAD_COOLDOWN_MS + 1000;

      expect(shouldPreloadNutritionWeek(userId)).toBe(true);

      Date.now = realNow;
    });

    it("should return true when forceRemote is true regardless of cooldown", () => {
      markNutritionWeekPreloaded(userId);
      expect(shouldPreloadNutritionWeek(userId, true)).toBe(true);
    });
  });

  describe("markNutritionWeekPreloaded", () => {
    it("should mark preload with custom timestamp", () => {
      const pastTimestamp = Date.now() - NUTRITION_WEEK_PRELOAD_COOLDOWN_MS - 5000;
      markNutritionWeekPreloaded(userId, pastTimestamp);
      expect(shouldPreloadNutritionWeek(userId)).toBe(true);
    });
  });
});
