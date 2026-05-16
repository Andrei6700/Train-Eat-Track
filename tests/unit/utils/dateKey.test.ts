import {
  DAY_IN_MS,
  toValidDate,
  startOfDay,
  toDateKey,
  isSameDay,
} from "@/src/utils/dateKey";

describe("DAY_IN_MS", () => {
  it("should equal 86400000 milliseconds", () => {
    expect(DAY_IN_MS).toBe(86_400_000);
  });
});

describe("toValidDate", () => {
  it("should return null for null", () => {
    expect(toValidDate(null)).toBeNull();
  });

  it("should return null for undefined", () => {
    expect(toValidDate(undefined)).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(toValidDate("")).toBeNull();
  });

  it("should return null for zero", () => {
    expect(toValidDate(0)).toBeNull();
  });

  it("should return a Date for a valid Date object", () => {
    const input = new Date("2025-06-15T10:30:00Z");
    const result = toValidDate(input);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(input.getTime());
  });

  it("should return a new Date instance (not the same reference)", () => {
    const input = new Date("2025-06-15T10:30:00Z");
    const result = toValidDate(input);
    expect(result).not.toBe(input);
  });

  it("should return null for an invalid Date object", () => {
    const invalid = new Date("not-a-date");
    expect(toValidDate(invalid)).toBeNull();
  });

  it("should parse a Firestore Timestamp-like object with toDate()", () => {
    const fakeTimestamp = {
      toDate: () => new Date("2025-01-01T00:00:00Z"),
    };
    const result = toValidDate(fakeTimestamp);
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });

  it("should return null for Timestamp-like object whose toDate() returns invalid date", () => {
    const fakeTimestamp = {
      toDate: () => new Date("invalid"),
    };
    expect(toValidDate(fakeTimestamp)).toBeNull();
  });

  it("should parse an ISO date string", () => {
    const result = toValidDate("2025-03-20T12:00:00Z");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(2); // March = 2
    expect(result!.getDate()).toBe(20);
  });

  it("should parse a numeric epoch timestamp", () => {
    const epoch = new Date("2025-12-25T00:00:00Z").getTime();
    const result = toValidDate(epoch);
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe("2025-12-25T00:00:00.000Z");
  });

  it("should return null for an unparseable string", () => {
    expect(toValidDate("hello-world")).toBeNull();
  });
});

describe("startOfDay", () => {
  it("should zero out hours, minutes, seconds, and milliseconds", () => {
    const input = new Date(2025, 5, 15, 14, 30, 45, 999);
    const result = startOfDay(input);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("should preserve the date", () => {
    const input = new Date(2025, 5, 15, 23, 59, 59);
    const result = startOfDay(input);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(15);
  });

  it("should return a new Date instance", () => {
    const input = new Date(2025, 0, 1);
    const result = startOfDay(input);
    expect(result).not.toBe(input);
  });

  it("should handle already-zeroed time", () => {
    const input = new Date(2025, 0, 1, 0, 0, 0, 0);
    const result = startOfDay(input);
    expect(result.getTime()).toBe(input.getTime());
  });
});

describe("toDateKey", () => {
  it("should return YYYY-MM-DD format", () => {
    const date = new Date(2025, 0, 5, 15, 30);
    expect(toDateKey(date)).toBe("2025-01-05");
  });

  it("should pad single-digit months", () => {
    const date = new Date(2025, 2, 3);
    expect(toDateKey(date)).toBe("2025-03-03");
  });

  it("should pad single-digit days", () => {
    const date = new Date(2025, 11, 9);
    expect(toDateKey(date)).toBe("2025-12-09");
  });

  it("should handle December 31st (year boundary)", () => {
    const date = new Date(2025, 11, 31, 23, 59, 59);
    expect(toDateKey(date)).toBe("2025-12-31");
  });

  it("should handle January 1st", () => {
    const date = new Date(2026, 0, 1, 0, 0, 0);
    expect(toDateKey(date)).toBe("2026-01-01");
  });

  it("should handle leap year Feb 29", () => {
    const date = new Date(2024, 1, 29);
    expect(toDateKey(date)).toBe("2024-02-29");
  });
});

describe("isSameDay", () => {
  it("should return true for the exact same moment", () => {
    const date = new Date(2025, 5, 15, 12, 0);
    expect(isSameDay(date, date)).toBe(true);
  });

  it("should return true for different times on the same day", () => {
    const morning = new Date(2025, 5, 15, 6, 0);
    const evening = new Date(2025, 5, 15, 22, 30);
    expect(isSameDay(morning, evening)).toBe(true);
  });

  it("should return false for different days", () => {
    const day1 = new Date(2025, 5, 15);
    const day2 = new Date(2025, 5, 16);
    expect(isSameDay(day1, day2)).toBe(false);
  });

  it("should return false for same day different months", () => {
    const jan15 = new Date(2025, 0, 15);
    const feb15 = new Date(2025, 1, 15);
    expect(isSameDay(jan15, feb15)).toBe(false);
  });

  it("should return false for same day different years", () => {
    const y2025 = new Date(2025, 5, 15);
    const y2026 = new Date(2026, 5, 15);
    expect(isSameDay(y2025, y2026)).toBe(false);
  });
});
