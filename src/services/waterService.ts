import { firestore } from "@/src/config/firebase";
import { DailyWater, ResponseType } from "@/src/types/index";
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
} from "firebase/firestore";

const COLLECTION_NAME = "waterTracking";
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

export const getWaterDateKey = (date: Date): string => {
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

const parseWaterDoc = (docId: string, payload: any, fallbackDate: Date): DailyWater => {
  const waterDate = parseFirestoreDate(payload.date, fallbackDate);
  const intakes = Array.isArray(payload.intakes)
    ? payload.intakes.map((intake: any) => ({
        amount: intake.amount,
        timestamp: parseFirestoreDate(intake.timestamp, waterDate),
      }))
    : [];
  const updatedAt = payload.updatedAt ? parseFirestoreDate(payload.updatedAt, waterDate) : undefined;

  return {
    id: docId,
    ...payload,
    date: waterDate,
    intakes,
    updatedAt,
  } as DailyWater;
};

/** Returns the user-scoped waterTracking subcollection reference */
const userWaterCol = (userID: string) =>
  collection(firestore, "users", userID, COLLECTION_NAME);

/** Returns a document reference within the user-scoped waterTracking subcollection */
const userWaterDoc = (userID: string, docId: string) =>
  doc(firestore, "users", userID, COLLECTION_NAME, docId);

export const getDailyWater = async (
  userID: string,
  date: Date,
): Promise<ResponseType> => {
  try {
    const dateKey = getWaterDateKey(date);

    const q = query(
      userWaterCol(userID),
      where("dateKey", "==", dateKey),
    );

    const querySnapshot = await withTimeout(
      getDocs(q),
      "getDailyWater.getDocs",
    );

    if (!querySnapshot.empty) {
      const firstDoc = querySnapshot.docs[0];
      return {
        success: true,
        data: parseWaterDoc(firstDoc.id, firstDoc.data(), date),
      };
    }

    return {
      success: true,
      data: null,
    };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[WaterService] Error fetching daily water:", error);
    }
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const saveDailyWater = async (
  water: DailyWater,
): Promise<ResponseType> => {
  try {
    const userID = water.userID;
    if (!userID) {
      return { success: false, msg: "Missing userID", code: "UNKNOWN_ERROR" };
    }

    const date = new Date(water.date);
    const dateKey = getWaterDateKey(date);

    const intakesForFirestore = water.intakes.map((intake) => ({
      amount: intake.amount,
      timestamp: Timestamp.fromDate(new Date(intake.timestamp)),
    }));

    if (water.id) {
      const docRef = userWaterDoc(userID, water.id);
      const { id, userID: _uid, localUpdatedAt, ...updateData } = water as DailyWater & {
        localUpdatedAt?: number;
      };

      await withTimeout(
        updateDoc(docRef, {
          ...updateData,
          dateKey,
          date: Timestamp.fromDate(date),
          intakes: intakesForFirestore,
          updatedAt: serverTimestamp(),
        }),
        "saveDailyWater.updateDoc",
      );

      return { success: true, data: { id: water.id } };
    }

    // Strip userID before writing to Firestore
    const { userID: _uid, ...waterWithoutUser } = water;

    const docRef = await withTimeout(
      addDoc(userWaterCol(userID), {
        ...waterWithoutUser,
        dateKey,
        date: Timestamp.fromDate(date),
        intakes: intakesForFirestore,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
      "saveDailyWater.addDoc",
    );

    return { success: true, data: { id: docRef.id } };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[WaterService] Error saving daily water:", error);
    }
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};
