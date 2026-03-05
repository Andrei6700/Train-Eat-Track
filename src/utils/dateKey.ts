export const DAY_IN_MS = 24 * 60 * 60 * 1000;

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
