export const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface DateRange {
  start: Date;
  end: Date;
}

export const toValidDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value);
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const dateValue = (value as { toDate?: () => Date }).toDate?.();
    if (!dateValue || Number.isNaN(dateValue.getTime())) return null;
    return new Date(dateValue);
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parts = value.split("-").map(Number);
    const parsed = new Date(parts[0], parts[1] - 1, parts[2]);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const startOfDay = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export const toDateKey = (date: Date): string => {
  const normalized = startOfDay(date);
  const year = normalized.getFullYear();
  const month = `${normalized.getMonth() + 1}`.padStart(2, "0");
  const day = `${normalized.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const isSameDay = (left: Date, right: Date): boolean =>
  toDateKey(left) === toDateKey(right);

export const getWeekRange = (anchorDate: Date = new Date()): DateRange => {
  const start = new Date(anchorDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 7);
  const end = new Date(anchorDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

export const getMonthRange = (anchorDate: Date = new Date()): DateRange => {
  const start = new Date(anchorDate);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - 1);
  const end = new Date(anchorDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

export const getYearRange = (anchorDate: Date = new Date()): DateRange => {
  const start = new Date(anchorDate);
  start.setHours(0, 0, 0, 0);
  start.setFullYear(start.getFullYear() - 1);
  const end = new Date(anchorDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

