export type WeightEntry = {
  date: string; // YYYY-MM-DD
  weight: number; // in kg
  calories?: number; // optional daily calories
};

export type WeeklyData = {
  weekNumber: number;
  startDate: string;
  endDate: string;
  entries: WeightEntry[];
  average: number | null;
};

export type MaintenanceStatus = "maintenance" | "surplus" | "deficit";

export type MaintenanceAnalysisResult = {
  week1Average: number;
  week2Average: number;
  difference: number;
  status: MaintenanceStatus;
  statusLabel: string;
  estimatedMaintenance?: number; // if calories data available
};

export type MaintenanceTrackerData = {
  entries: WeightEntry[];
  onboardingSeen: boolean;
};

export const MAINTENANCE_STORAGE_KEYS = {
  WEIGHT_ENTRIES: "@weight_entries",
  ONBOARDING_SEEN: "@maintenance_onboarding_seen",
  CACHE_TIMESTAMP: "@maintenance_cache_timestamp",
} as const;

// Week day names in Romanian
export const WEEK_DAYS_RO: Record<number, string> = {
  0: "Duminică",
  1: "Luni",
  2: "Marți",
  3: "Miercuri",
  4: "Joi",
  5: "Vineri",
  6: "Sâmbătă",
};

export const WEEK_DAYS_EN: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};
