// Mock Firebase and AsyncStorage before any imports
jest.mock("@/src/config/firebase", () => ({
  firestore: {},
}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  serverTimestamp: jest.fn(),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import {
  formatDateKey,
  parseDateKey,
  getWeekNumber,
  getWeekStartDate,
  getWeekEndDate,
  groupEntriesByWeek,
  analyzeMaintenanceStatus,
  generateWeekDays,
} from "@/src/services/maintenanceService";
import { WeeklyData, WeightEntry } from "@/src/types/maintenance";

describe("formatDateKey", () => {
  it("should format date as YYYY-MM-DD", () => {
    expect(formatDateKey(new Date(2025, 0, 5))).toBe("2025-01-05");
  });

  it("should pad single-digit month and day", () => {
    expect(formatDateKey(new Date(2025, 2, 3))).toBe("2025-03-03");
  });

  it("should handle December 31", () => {
    expect(formatDateKey(new Date(2025, 11, 31))).toBe("2025-12-31");
  });
});

describe("parseDateKey", () => {
  it("should parse YYYY-MM-DD to a Date", () => {
    const result = parseDateKey("2025-06-15");
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(15);
  });

  it("should roundtrip with formatDateKey", () => {
    const original = new Date(2025, 0, 1);
    const key = formatDateKey(original);
    const parsed = parseDateKey(key);
    expect(parsed.getFullYear()).toBe(original.getFullYear());
    expect(parsed.getMonth()).toBe(original.getMonth());
    expect(parsed.getDate()).toBe(original.getDate());
  });
});

describe("getWeekStartDate", () => {
  it("should return Monday for a Wednesday", () => {
    const result = getWeekStartDate(new Date(2025, 5, 18));
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(16);
  });

  it("should return same date if already Monday", () => {
    const result = getWeekStartDate(new Date(2025, 5, 16));
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(16);
  });

  it("should return previous Monday for a Sunday", () => {
    const result = getWeekStartDate(new Date(2025, 5, 22));
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(16);
  });
});

describe("getWeekEndDate", () => {
  it("should return Sunday (6 days after Monday start)", () => {
    const result = getWeekEndDate(new Date(2025, 5, 18));
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(22);
  });
});

describe("getWeekNumber", () => {
  it("should return 1 for the first week of the year", () => {
    const result = getWeekNumber(new Date(2025, 0, 1));
    expect(result).toBe(1);
  });

  it("should return a positive number for any date", () => {
    const result = getWeekNumber(new Date(2025, 5, 15));
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(53);
  });
});

describe("groupEntriesByWeek", () => {
  it("should return empty array for no entries", () => {
    expect(groupEntriesByWeek([])).toEqual([]);
  });

  it("should group entries in the same week together", () => {
    const entries: WeightEntry[] = [
      { date: "2025-06-16", weight: 80 },
      { date: "2025-06-17", weight: 80.5 },
      { date: "2025-06-18", weight: 79.8 },
    ];
    const result = groupEntriesByWeek(entries);
    expect(result).toHaveLength(1);
    expect(result[0].entries).toHaveLength(3);
    expect(result[0].weekNumber).toBe(1);
  });

  it("should split entries across different weeks", () => {
    const entries: WeightEntry[] = [
      { date: "2025-06-16", weight: 80 },
      { date: "2025-06-23", weight: 79 },
    ];
    const result = groupEntriesByWeek(entries);
    expect(result).toHaveLength(2);
  });

  it("should calculate average weight correctly", () => {
    const entries: WeightEntry[] = [
      { date: "2025-06-16", weight: 80 },
      { date: "2025-06-17", weight: 82 },
    ];
    const result = groupEntriesByWeek(entries);
    expect(result[0].average).toBe(81);
  });

  it("should exclude zero-weight entries from average", () => {
    const entries: WeightEntry[] = [
      { date: "2025-06-16", weight: 80 },
      { date: "2025-06-17", weight: 0 },
    ];
    const result = groupEntriesByWeek(entries);
    expect(result[0].average).toBe(80);
  });

  it("should return null average when all weights are zero", () => {
    const entries: WeightEntry[] = [{ date: "2025-06-16", weight: 0 }];
    const result = groupEntriesByWeek(entries);
    expect(result[0].average).toBeNull();
  });
});

describe("analyzeMaintenanceStatus", () => {
  const makeWeek = (avg: number | null, weekNum: number): WeeklyData => ({
    weekNumber: weekNum,
    startDate: "2025-06-16",
    endDate: "2025-06-22",
    entries: [],
    average: avg,
  });

  it("should return null with fewer than 2 weeks", () => {
    expect(analyzeMaintenanceStatus([makeWeek(80, 1)])).toBeNull();
  });

  it("should return null when weeks lack averages", () => {
    expect(analyzeMaintenanceStatus([makeWeek(null, 1), makeWeek(null, 2)])).toBeNull();
  });

  it("should detect maintenance when difference < 0.2kg", () => {
    const result = analyzeMaintenanceStatus([makeWeek(80, 1), makeWeek(80.1, 2)]);
    expect(result!.status).toBe("maintenance");
  });

  it("should detect surplus when weight increases >= 0.2kg", () => {
    const result = analyzeMaintenanceStatus([makeWeek(80, 1), makeWeek(80.5, 2)]);
    expect(result!.status).toBe("surplus");
  });

  it("should detect deficit when weight decreases >= 0.2kg", () => {
    const result = analyzeMaintenanceStatus([makeWeek(80, 1), makeWeek(79.5, 2)]);
    expect(result!.status).toBe("deficit");
  });

  it("should use English labels when language is 'en'", () => {
    const result = analyzeMaintenanceStatus([makeWeek(80, 1), makeWeek(80, 2)], "en");
    expect(result!.statusLabel).toBe("At maintenance");
  });

  it("should use Romanian labels when language is 'ro'", () => {
    const result = analyzeMaintenanceStatus([makeWeek(80, 1), makeWeek(80, 2)], "ro");
    expect(result!.statusLabel).toBe("La mentenanță");
  });

  it("should estimate maintenance calories when enough calorie data exists", () => {
    const week1: WeeklyData = {
      weekNumber: 1, startDate: "2025-06-16", endDate: "2025-06-22",
      entries: [
        { date: "2025-06-16", weight: 80, calories: 2500 },
        { date: "2025-06-17", weight: 80, calories: 2400 },
        { date: "2025-06-18", weight: 80, calories: 2600 },
        { date: "2025-06-19", weight: 80, calories: 2500 },
      ],
      average: 80,
    };
    const week2: WeeklyData = {
      weekNumber: 2, startDate: "2025-06-23", endDate: "2025-06-29",
      entries: [
        { date: "2025-06-23", weight: 80.5, calories: 2700 },
        { date: "2025-06-24", weight: 80.5, calories: 2800 },
        { date: "2025-06-25", weight: 80.5, calories: 2600 },
      ],
      average: 80.5,
    };
    const result = analyzeMaintenanceStatus([week1, week2]);
    expect(result!.estimatedMaintenance).toBeDefined();
    expect(typeof result!.estimatedMaintenance).toBe("number");
  });

  it("should not estimate maintenance when insufficient calorie data", () => {
    const result = analyzeMaintenanceStatus([
      { weekNumber: 1, startDate: "a", endDate: "b", entries: [{ date: "2025-06-16", weight: 80 }], average: 80 },
      { weekNumber: 2, startDate: "a", endDate: "b", entries: [{ date: "2025-06-23", weight: 80.5 }], average: 80.5 },
    ]);
    expect(result!.estimatedMaintenance).toBeUndefined();
  });
});

describe("generateWeekDays", () => {
  it("should generate 7 days", () => {
    const result = generateWeekDays(new Date(2025, 5, 16), []);
    expect(result).toHaveLength(7);
  });

  it("should start from the given date", () => {
    const result = generateWeekDays(new Date(2025, 5, 16), []);
    expect(result[0].date).toBe("2025-06-16");
    expect(result[6].date).toBe("2025-06-22");
  });

  it("should map existing entries to matching days", () => {
    const entries: WeightEntry[] = [{ date: "2025-06-17", weight: 80 }];
    const result = generateWeekDays(new Date(2025, 5, 16), entries);
    expect(result[0].entry).toBeNull();
    expect(result[1].entry).toEqual(entries[0]);
  });

  it("should set entry to null for days without data", () => {
    const result = generateWeekDays(new Date(2025, 5, 16), []);
    result.forEach((day) => expect(day.entry).toBeNull());
  });
});
