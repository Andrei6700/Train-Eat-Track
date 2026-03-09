import { firestore } from "@/src/config/firebase";
import { DailyNutrition, ResponseType } from "@/src/types/index";
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

const COLLECTION_NAME = "nutrition";

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

export const getDailyNutrition = async (
  userID: string,
  date: Date,
): Promise<ResponseType> => {
  try {
    const dateKey = getDateKey(date);

    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      where("dateKey", "==", dateKey),
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const firstDoc = querySnapshot.docs[0];
      return {
        success: true,
        data: parseNutritionDoc(firstDoc.id, firstDoc.data(), date),
      };
    }

    return {
      success: true,
      data: null,
    };
  } catch (error: any) {
    console.error("[NutritionService] Error fetching daily nutrition:", error);
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const saveDailyNutrition = async (
  nutrition: DailyNutrition,
): Promise<ResponseType> => {
  try {
    const date = new Date(nutrition.date);
    const dateKey = getDateKey(date);

    if (nutrition.id) {
      const docRef = doc(firestore, COLLECTION_NAME, nutrition.id);
      const { id, localUpdatedAt, ...updateData } = nutrition as DailyNutrition & {
        localUpdatedAt?: number;
      };

      await updateDoc(docRef, {
        ...updateData,
        dateKey,
        date: Timestamp.fromDate(date),
        updatedAt: serverTimestamp(),
      });

      return { success: true, data: { id: nutrition.id } };
    }

    const docRef = await addDoc(collection(firestore, COLLECTION_NAME), {
      ...nutrition,
      dateKey,
      date: Timestamp.fromDate(date),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { success: true, data: { id: docRef.id } };
  } catch (error: any) {
    console.error("[NutritionService] Error saving daily nutrition:", error);
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const getUserNutritionHistory = async (
  userID: string,
): Promise<ResponseType> => {
  try {
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
    );

    const querySnapshot = await getDocs(q);
    const nutritionHistory: DailyNutrition[] = [];

    querySnapshot.forEach((docSnap) => {
      nutritionHistory.push(parseNutritionDoc(docSnap.id, docSnap.data(), new Date()));
    });

    nutritionHistory.sort((left, right) => {
      const leftTime = parseFirestoreDate(left.date, new Date(0)).getTime();
      const rightTime = parseFirestoreDate(right.date, new Date(0)).getTime();
      return rightTime - leftTime;
    });

    return { success: true, data: nutritionHistory };
  } catch (error: any) {
    console.error("[NutritionService] Error fetching nutrition history:", error);
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
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
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      where("dateKey", "==", dateKey),
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docRef = doc(firestore, COLLECTION_NAME, querySnapshot.docs[0].id);
      await updateDoc(docRef, {
        ...goals,
        updatedAt: serverTimestamp(),
      });
    }

    return { success: true, msg: "Goals updated successfully" };
  } catch (error: any) {
    console.error("[NutritionService] Error updating goals:", error);
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};
