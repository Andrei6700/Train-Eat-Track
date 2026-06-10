import { firestore } from "@/src/config/firebase";
import {
  getCachedNutritionCalendarSummary,
  setCachedNutritionCalendarSummary,
} from "@/src/services/nutritionCalendarCacheService";
import { DailyNutrition, ResponseType } from "@/src/types/index";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

const COLLECTION_NAME = "nutrition";
const REMOTE_TIMEOUT_MS = 8000;

const withTimeout = async <T>(
  promise: Promise<T>,
  operationName: string,
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

const normalizeDate = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export const getDateKey = (date: Date): string => {
  const normalized = normalizeDate(date);
  return `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, "0")}-${String(
    normalized.getDate(),
  ).padStart(2, "0")}`;
};

const parseFirestoreDate = (value: unknown, fallback: Date): Date => {
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  const parsed = new Date(value as any);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const parseNutritionDoc = (docId: string, payload: any, fallbackDate: Date): DailyNutrition => {
  const nutritionDate = parseFirestoreDate(payload.date, fallbackDate);
  const updatedAt = payload.updatedAt ? parseFirestoreDate(payload.updatedAt, nutritionDate) : undefined;

  return {
    id: docId,
    ...payload,
    date: nutritionDate,
    updatedAt,
  } as DailyNutrition;
};

const getDocUpdatedAtMillis = (payload: any, fallbackDate: Date): number => {
  const candidate =
    payload.updatedAt ?? payload.createdAt ?? payload.date ?? fallbackDate;
  return parseFirestoreDate(candidate, fallbackDate).getTime();
};

const parseDateFromDateKey = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;

  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  const day = Number.parseInt(dayRaw ?? "", 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseDateFromUnknown = (value: unknown): Date | null => {
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const pickLatestNutritionDoc = (
  docs: { id: string; data: () => any }[],
  fallbackDate: Date,
): { id: string; data: () => any } => {
  let best = docs[0];
  let bestUpdatedAt = getDocUpdatedAtMillis(best.data(), fallbackDate);

  for (let index = 1; index < docs.length; index += 1) {
    const current = docs[index];
    const currentUpdatedAt = getDocUpdatedAtMillis(current.data(), fallbackDate);
    if (currentUpdatedAt > bestUpdatedAt) {
      best = current;
      bestUpdatedAt = currentUpdatedAt;
    }
  }

  return best;
};

/** Returns the user-scoped nutrition subcollection reference */
const userNutritionCol = (userID: string) =>
  collection(firestore, "users", userID, COLLECTION_NAME);

/** Returns a document reference within the user-scoped nutrition subcollection */
const userNutritionDoc = (userID: string, docId: string) =>
  doc(firestore, "users", userID, COLLECTION_NAME, docId);

export const getDailyNutrition = async (
  userID: string,
  date: Date,
): Promise<ResponseType> => {
  try {
    const dateKey = getDateKey(date);

    const q = query(
      userNutritionCol(userID),
      where("dateKey", "==", dateKey),
    );

    const querySnapshot = await withTimeout(
      getDocs(q),
      "getDailyNutrition.getDocs",
    );

    if (!querySnapshot.empty) {
      const latestDoc = pickLatestNutritionDoc(querySnapshot.docs, date);
      return {
        success: true,
        data: parseNutritionDoc(latestDoc.id, latestDoc.data(), date),
      };
    }

    return {
      success: true,
      data: null,
    };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[NutritionService] Error fetching daily nutrition:", error);
    }
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const saveDailyNutrition = async (
  nutrition: DailyNutrition,
): Promise<ResponseType> => {
  try {
    const userID = nutrition.userID;
    if (!userID) {
      return { success: false, msg: "Missing userID", code: "UNKNOWN_ERROR" };
    }

    const date = new Date(nutrition.date);
    const dateKey = getDateKey(date);

    if (nutrition.id) {
      const docRef = userNutritionDoc(userID, nutrition.id);
      const { id, userID: _uid, localUpdatedAt, ...updateData } = nutrition as DailyNutrition & {
        localUpdatedAt?: number;
      };

      await withTimeout(
        updateDoc(docRef, {
          ...updateData,
          dateKey,
          date: Timestamp.fromDate(date),
          updatedAt: serverTimestamp(),
        }),
        "saveDailyNutrition.updateDoc",
      );

      return { success: true, data: { id: nutrition.id } };
    }

    const q = query(
      userNutritionCol(userID),
      where("dateKey", "==", dateKey),
    );
    const querySnapshot = await withTimeout(
      getDocs(q),
      "saveDailyNutrition.getDocs",
    );

    if (!querySnapshot.empty) {
      const latestDoc = pickLatestNutritionDoc(querySnapshot.docs, date);
      const docRef = userNutritionDoc(userID, latestDoc.id);
      const { id, userID: _uid, localUpdatedAt, ...updateData } = nutrition as DailyNutrition & {
        localUpdatedAt?: number;
      };

      await withTimeout(
        updateDoc(docRef, {
          ...updateData,
          dateKey,
          date: Timestamp.fromDate(date),
          updatedAt: serverTimestamp(),
        }),
        "saveDailyNutrition.updateDoc",
      );

      return { success: true, data: { id: latestDoc.id } };
    }

    // Strip userID before writing to Firestore
    const { userID: _uid, ...nutritionWithoutUser } = nutrition;

    const docRef = await withTimeout(
      addDoc(userNutritionCol(userID), {
        ...nutritionWithoutUser,
        dateKey,
        date: Timestamp.fromDate(date),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
      "saveDailyNutrition.addDoc",
    );

    return { success: true, data: { id: docRef.id } };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[NutritionService] Error saving daily nutrition:", error);
    }
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const getUserNutritionHistory = async (
  userID: string,
): Promise<ResponseType> => {
  try {
    const q = query(
      userNutritionCol(userID),
    );

    const querySnapshot = await withTimeout(
      getDocs(q),
      "getUserNutritionHistory.getDocs",
    );
    const nutritionHistory: DailyNutrition[] = [];

    querySnapshot.forEach((docSnap) => {
      nutritionHistory.push(parseNutritionDoc(docSnap.id, docSnap.data(), new Date()));
    });

    nutritionHistory.sort((left, right) => {
      const leftDate = parseFirestoreDate(left.date, new Date(0));
      const rightDate = parseFirestoreDate(right.date, new Date(0));
      const leftDay = new Date(
        leftDate.getFullYear(),
        leftDate.getMonth(),
        leftDate.getDate(),
      ).getTime();
      const rightDay = new Date(
        rightDate.getFullYear(),
        rightDate.getMonth(),
        rightDate.getDate(),
      ).getTime();

      if (rightDay !== leftDay) {
        return rightDay - leftDay;
      }

      const leftUpdated = parseFirestoreDate(
        (left as any).updatedAt ?? (left as any).createdAt ?? left.date,
        new Date(0),
      ).getTime();
      const rightUpdated = parseFirestoreDate(
        (right as any).updatedAt ?? (right as any).createdAt ?? right.date,
        new Date(0),
      ).getTime();

      return rightUpdated - leftUpdated;
    });

    return { success: true, data: nutritionHistory };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[NutritionService] Error fetching nutrition history:", error);
    }
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const getUserNutritionEarliestDate = async (
  userID: string,
): Promise<Date | null> => {
  const getEarliestFromUserOnlyQuery = async (): Promise<Date | null> => {
    const fallbackQuery = query(
      userNutritionCol(userID),
    );

    const querySnapshot = await withTimeout(
      getDocs(fallbackQuery),
      "getUserNutritionEarliestDate.fallbackGetDocs",
    );

    if (querySnapshot.empty) {
      return null;
    }

    let earliestTimestamp = Number.POSITIVE_INFINITY;

    querySnapshot.forEach((docSnap) => {
      const payload = docSnap.data();
      const fromDateKey = parseDateFromDateKey(payload?.dateKey);
      const fromDate = parseDateFromUnknown(payload?.date);
      const candidate = fromDateKey ?? fromDate;

      if (!candidate) return;
      const normalized = normalizeDate(candidate);
      const timestamp = normalized.getTime();
      if (timestamp < earliestTimestamp) {
        earliestTimestamp = timestamp;
      }
    });

    if (!Number.isFinite(earliestTimestamp)) {
      return null;
    }

    return new Date(earliestTimestamp);
  };

  try {
    const q = query(
      userNutritionCol(userID),
      orderBy("dateKey", "asc"),
      limit(1),
    );

    const querySnapshot = await withTimeout(
      getDocs(q),
      "getUserNutritionEarliestDate.getDocs",
    );

    if (querySnapshot.empty) {
      return null;
    }

    const docSnap = querySnapshot.docs[0];
    const parsed = parseNutritionDoc(docSnap.id, docSnap.data(), new Date(0));
    return parsed?.date ? normalizeDate(new Date(parsed.date)) : null;
  } catch (error: any) {
    const isMissingIndex =
      error?.code === "failed-precondition" ||
      String(error?.message || "").includes("requires an index");

    if (!isMissingIndex) {
      if (__DEV__) {
        console.error("[NutritionService] Error fetching earliest nutrition date:", error);
      }
      return null;
    }

    try {
      const fallbackEarliestDate = await getEarliestFromUserOnlyQuery();
      if (__DEV__) {
        console.log(
          "[NutritionService] Earliest nutrition date loaded via fallback query",
        );
      }
      return fallbackEarliestDate;
    } catch (fallbackError) {
      if (__DEV__) {
        console.error(
          "[NutritionService] Error fetching earliest nutrition date via fallback:",
          fallbackError,
        );
      }
      return null;
    }
  }
};

export const updateNutritionGoals = async (
  userID: string,
  goals: {
    calorieGoal?: number;
    proteinGoal?: number;
    carbsGoal?: number;
    fatGoal?: number;
  },
): Promise<ResponseType> => {
  try {
    const dateKey = getDateKey(new Date());

    const q = query(
      userNutritionCol(userID),
      where("dateKey", "==", dateKey),
    );

    const querySnapshot = await withTimeout(
      getDocs(q),
      "updateNutritionGoals.getDocs",
    );

    if (!querySnapshot.empty) {
      const docRef = userNutritionDoc(userID, querySnapshot.docs[0].id);
      await withTimeout(
        updateDoc(docRef, {
          ...goals,
          updatedAt: serverTimestamp(),
        }),
        "updateNutritionGoals.updateDoc",
      );
    }

    return { success: true, msg: "Goals updated successfully" };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[NutritionService] Error updating goals:", error);
    }
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

let activePrefetchPromise: Promise<void> | null = null;
let memoryEarliestDate: { userID: string; earliestDate: string | null } | null = null;

export const getMemoryEarliestDate = (userID: string): string | null | undefined => {
  if (memoryEarliestDate && memoryEarliestDate.userID === userID) {
    return memoryEarliestDate.earliestDate;
  }
  return undefined;
};

export const prefetchNutritionCalendarSummary = (
  userID: string,
): Promise<void> => {
  if (activePrefetchPromise) return activePrefetchPromise;

  activePrefetchPromise = (async () => {
    try {
      const cachedSummary = await getCachedNutritionCalendarSummary(userID, {
        allowStale: true,
      });
      const existingEarliest = cachedSummary.data?.earliestDate ?? null;
      const existingDays = cachedSummary.data?.days ?? [];

      if (existingEarliest) {
        memoryEarliestDate = { userID, earliestDate: existingEarliest };
        return;
      }

      const earliestDate = await getUserNutritionEarliestDate(userID);
      const earliestIso = earliestDate ? earliestDate.toISOString() : existingEarliest;
      memoryEarliestDate = { userID, earliestDate: earliestIso };

      await setCachedNutritionCalendarSummary(userID, {
        earliestDate: earliestIso,
        days: existingDays,
      });
    } catch (error) {
      if (__DEV__) {
        console.error("[NutritionService] Error prefetching calendar summary:", error);
      }
    } finally {
      activePrefetchPromise = null;
    }
  })();

  return activePrefetchPromise;
};

export const awaitNutritionCalendarPrefetch = async (): Promise<void> => {
  if (activePrefetchPromise) await activePrefetchPromise;
};

export const getNutritionForDateRange = async (
  userID: string,
  startDate: Date,
  endDate: Date,
): Promise<ResponseType> => {
  try {
    const q = query(
      userNutritionCol(userID),
      where("date", ">=", Timestamp.fromDate(startDate)),
      where("date", "<=", Timestamp.fromDate(endDate)),
    );

    const querySnapshot = await withTimeout(
      getDocs(q),
      "getNutritionForDateRange.getDocs",
    );

    const nutritionList: DailyNutrition[] = [];
    querySnapshot.forEach((docSnap) => {
      const payload = docSnap.data();
      const docDate = parseFirestoreDate(payload.date, new Date());
      nutritionList.push(parseNutritionDoc(docSnap.id, payload, docDate));
    });

    return {
      success: true,
      data: nutritionList,
    };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[NutritionService] Error fetching nutrition for range:", error);
    }
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};
