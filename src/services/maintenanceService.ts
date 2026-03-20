import AsyncStorage from "@react-native-async-storage/async-storage";
import { firestore } from "@/src/config/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  deleteDoc,
} from "firebase/firestore";
import {
  WeightEntry,
  WeeklyData,
  MaintenanceAnalysisResult,
  MaintenanceStatus,
  MAINTENANCE_STORAGE_KEYS,
} from "@/src/types/maintenance";
import { ResponseType } from "@/src/types/index";

const COLLECTION_NAME = "weight_entries";
const REMOTE_TIMEOUT_MS = 8000;

const withTimeout = async <T>(
  promise: Promise<T>,
  operationName: string
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${operationName} timed out after ${REMOTE_TIMEOUT_MS}ms`));
        }, REMOTE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

// AsyncStorage: Onboarding
export const hasSeenOnboarding = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(MAINTENANCE_STORAGE_KEYS.ONBOARDING_SEEN);
    return value === "true";
  } catch {
    return false;
  }
};

export const setOnboardingSeen = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(MAINTENANCE_STORAGE_KEYS.ONBOARDING_SEEN, "true");
  } catch (error) {
    if (__DEV__) {
      console.error("[MaintenanceService] Error saving onboarding status:", error);
    }
  }
};

// AsyncStorage: Local cache for weight entries
export const getCachedWeightEntries = async (): Promise<WeightEntry[]> => {
  try {
    const value = await AsyncStorage.getItem(MAINTENANCE_STORAGE_KEYS.WEIGHT_ENTRIES);
    if (value) {
      return JSON.parse(value);
    }
    return [];
  } catch {
    return [];
  }
};

export const setCachedWeightEntries = async (entries: WeightEntry[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      MAINTENANCE_STORAGE_KEYS.WEIGHT_ENTRIES,
      JSON.stringify(entries)
    );
  } catch (error) {
    if (__DEV__) {
      console.error("[MaintenanceService] Error caching weight entries:", error);
    }
  }
};

// Firebase: Weight entries
export const getWeightEntries = async (userID: string): Promise<ResponseType> => {
  try {
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID)
    );

    const querySnapshot = await withTimeout(
      getDocs(q),
      "getWeightEntries.getDocs"
    );

    const entries: WeightEntry[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      entries.push({
        date: data.date,
        weight: data.weight,
        calories: data.calories,
      });
    });

    // Sort by date descending
    entries.sort((a, b) => b.date.localeCompare(a.date));

    // Cache locally
    await setCachedWeightEntries(entries);

    return { success: true, data: entries };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[MaintenanceService] Error fetching weight entries:", error);
    }
    // Try to return cached data on error
    const cached = await getCachedWeightEntries();
    if (cached.length > 0) {
      return { success: true, data: cached };
    }
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const saveWeightEntry = async (
  userID: string,
  entry: WeightEntry
): Promise<ResponseType> => {
  try {
    // Check if entry for this date already exists
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      where("date", "==", entry.date)
    );

    const querySnapshot = await withTimeout(
      getDocs(q),
      "saveWeightEntry.checkExisting"
    );

    if (!querySnapshot.empty) {
      // Update existing entry
      const docRef = doc(firestore, COLLECTION_NAME, querySnapshot.docs[0].id);
      await withTimeout(
        updateDoc(docRef, {
          weight: entry.weight,
          calories: entry.calories ?? null,
          updatedAt: serverTimestamp(),
        }),
        "saveWeightEntry.updateDoc"
      );
    } else {
      // Create new entry
      await withTimeout(
        addDoc(collection(firestore, COLLECTION_NAME), {
          userID,
          date: entry.date,
          weight: entry.weight,
          calories: entry.calories ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        "saveWeightEntry.addDoc"
      );
    }

    // Update local cache
    const cached = await getCachedWeightEntries();
    const existingIndex = cached.findIndex((e) => e.date === entry.date);
    if (existingIndex >= 0) {
      cached[existingIndex] = entry;
    } else {
      cached.push(entry);
    }
    cached.sort((a, b) => b.date.localeCompare(a.date));
    await setCachedWeightEntries(cached);

    return { success: true };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[MaintenanceService] Error saving weight entry:", error);
    }
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const deleteWeightEntry = async (
  userID: string,
  date: string
): Promise<ResponseType> => {
  try {
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      where("date", "==", date)
    );

    const querySnapshot = await withTimeout(
      getDocs(q),
      "deleteWeightEntry.getDocs"
    );

    if (!querySnapshot.empty) {
      await withTimeout(
        deleteDoc(doc(firestore, COLLECTION_NAME, querySnapshot.docs[0].id)),
        "deleteWeightEntry.deleteDoc"
      );
    }

    // Update local cache
    const cached = await getCachedWeightEntries();
    const filtered = cached.filter((e) => e.date !== date);
    await setCachedWeightEntries(filtered);

    return { success: true };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[MaintenanceService] Error deleting weight entry:", error);
    }
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

// Utility functions
export const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

export const getWeekStartDate = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
  return new Date(d.setDate(diff));
};

export const getWeekEndDate = (date: Date): Date => {
  const start = getWeekStartDate(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
};

// Group entries by week
export const groupEntriesByWeek = (entries: WeightEntry[]): WeeklyData[] => {
  if (entries.length === 0) return [];

  const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const weekMap = new Map<string, WeightEntry[]>();

  sortedEntries.forEach((entry) => {
    const date = parseDateKey(entry.date);
    const weekStart = getWeekStartDate(date);
    const weekKey = formatDateKey(weekStart);

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey)!.push(entry);
  });

  const weeks: WeeklyData[] = [];
  let weekNumber = 1;

  const sortedWeekKeys = Array.from(weekMap.keys()).sort();

  sortedWeekKeys.forEach((weekKey) => {
    const weekEntries = weekMap.get(weekKey)!;
    const startDate = parseDateKey(weekKey);
    const endDate = getWeekEndDate(startDate);

    const validWeights = weekEntries.filter((e) => e.weight > 0);
    const average =
      validWeights.length > 0
        ? validWeights.reduce((sum, e) => sum + e.weight, 0) / validWeights.length
        : null;

    weeks.push({
      weekNumber,
      startDate: formatDateKey(startDate),
      endDate: formatDateKey(endDate),
      entries: weekEntries,
      average: average ? Math.round(average * 100) / 100 : null,
    });

    weekNumber++;
  });

  return weeks;
};

// Analyze maintenance status
export const analyzeMaintenanceStatus = (
  weeks: WeeklyData[],
  language: "en" | "ro" = "ro"
): MaintenanceAnalysisResult | null => {
  if (weeks.length < 2) return null;

  // Get the last two weeks with averages
  const weeksWithAverages = weeks.filter((w) => w.average !== null);
  if (weeksWithAverages.length < 2) return null;

  const lastTwoWeeks = weeksWithAverages.slice(-2);
  const week1 = lastTwoWeeks[0];
  const week2 = lastTwoWeeks[1];

  if (week1.average === null || week2.average === null) return null;

  const difference = week2.average - week1.average;
  const absDifference = Math.abs(difference);

  let status: MaintenanceStatus;
  let statusLabel: string;

  if (absDifference < 0.2) {
    status = "maintenance";
    statusLabel = language === "ro" ? "La mentenanță" : "At maintenance";
  } else if (difference >= 0.2) {
    status = "surplus";
    statusLabel = language === "ro" ? "Mănânci peste mentenanță" : "Eating above maintenance";
  } else {
    status = "deficit";
    statusLabel = language === "ro" ? "Mănânci sub mentenanță" : "Eating below maintenance";
  }

  // Calculate estimated maintenance if calories data is available
  let estimatedMaintenance: number | undefined;

  const allEntries = [...week1.entries, ...week2.entries];
  const entriesWithCalories = allEntries.filter((e) => e.calories && e.calories > 0);

  if (entriesWithCalories.length >= 7) {
    const avgCalories =
      entriesWithCalories.reduce((sum, e) => sum + (e.calories || 0), 0) /
      entriesWithCalories.length;

    // Using 3500 kcal ≈ 0.5 kg rule (7000 kcal per kg)
    // Weight change per week × 7000 / 7 days = daily calorie difference from maintenance
    const weeklyWeightChange = difference / 2; // Average change per week
    const dailyCalorieAdjustment = (weeklyWeightChange * 7000) / 7;

    estimatedMaintenance = Math.round(avgCalories - dailyCalorieAdjustment);
  }

  return {
    week1Average: week1.average,
    week2Average: week2.average,
    difference: Math.round(difference * 100) / 100,
    status,
    statusLabel,
    estimatedMaintenance,
  };
};

// Generate days for a week (including empty days)
export const generateWeekDays = (
  weekStart: Date,
  entries: WeightEntry[]
): Array<{ date: string; dayOfWeek: number; entry: WeightEntry | null }> => {
  const days: Array<{ date: string; dayOfWeek: number; entry: WeightEntry | null }> = [];
  const entryMap = new Map(entries.map((e) => [e.date, e]));

  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(currentDate.getDate() + i);
    const dateKey = formatDateKey(currentDate);

    days.push({
      date: dateKey,
      dayOfWeek: currentDate.getDay(),
      entry: entryMap.get(dateKey) || null,
    });
  }

  return days;
};
