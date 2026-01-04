import { firestore } from "@/src/config/firebase";
import { DailyNutrition, ResponseType } from '@/src/types/index';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from "firebase/firestore";

const COLLECTION_NAME = "nutrition";

// ✅ Helper pentru a normaliza data la midnight
const normalizeDate = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

// ✅ Helper pentru a crea document ID consistent
const getDateKey = (date: Date): string => {
  const normalized = normalizeDate(date);
  return `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, '0')}-${String(normalized.getDate()).padStart(2, '0')}`;
};

// Obține datele nutriționale pentru o zi specificată
export const getDailyNutrition = async (
  userID: string,
  date: Date
): Promise<ResponseType> => {
  try {
    const dateKey = getDateKey(date);

    console.log('[NutritionService] Searching for dateKey:', dateKey);

    // ✅ Căutăm după userID și dateKey (nu mai comparăm timestamp-uri)
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      where("dateKey", "==", dateKey)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docData = querySnapshot.docs[0];
      const data = docData.data() as any;

      console.log('[NutritionService] Found existing document:', docData.id);

      // Convertim date field din Timestamp în Date
      let nutritionDate = date;
      if (data.date) {
        nutritionDate = data.date instanceof Timestamp
          ? data.date.toDate()
          : new Date(data.date);
      }

      return {
        success: true,
        data: {
          id: docData.id,
          ...data,
          date: nutritionDate,
        } as DailyNutrition,
      };
    }

    console.log('[NutritionService] No document found for dateKey:', dateKey);

    // ✅ NU MAI CREĂM DOCUMENT AICI - doar returnăm null
    return {
      success: true,
      data: null,
    };
  } catch (error: any) {
    console.error("[NutritionService] Error fetching daily nutrition:", error);
    return { success: false, msg: error?.message };
  }
};

// Salvează sau actualizează datele nutriționale zilnice
export const saveDailyNutrition = async (
  nutrition: DailyNutrition
): Promise<ResponseType> => {
  try {
    const dateKey = getDateKey(new Date(nutrition.date));

    if (nutrition.id) {
      // ✅ UPDATE - păstrăm ID-ul existent
      console.log('[NutritionService] Updating document:', nutrition.id);

      const docRef = doc(firestore, COLLECTION_NAME, nutrition.id);
      const { id, ...updateData } = nutrition;

      await updateDoc(docRef, {
        ...updateData,
        dateKey, // ✅ Salvăm și dateKey pentru căutare
        date: Timestamp.fromDate(new Date(nutrition.date)),
        updatedAt: serverTimestamp(),
      });

      return { success: true, msg: "Nutrition updated successfully" };
    } else {
      // ✅ CREATE - document nou
      console.log('[NutritionService] Creating new document for dateKey:', dateKey);

      const docRef = await addDoc(collection(firestore, COLLECTION_NAME), {
        ...nutrition,
        dateKey, // ✅ Salvăm dateKey pentru căutare rapidă
        date: Timestamp.fromDate(new Date(nutrition.date)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log('[NutritionService] Document created with ID:', docRef.id);

      return { success: true, data: { id: docRef.id } };
    }
  } catch (error: any) {
    console.error("[NutritionService] Error saving daily nutrition:", error);
    return { success: false, msg: error?.message };
  }
};

// Obține istoricul nutrițional al user-ului
export const getUserNutritionHistory = async (
  userID: string
): Promise<ResponseType> => {
  try {
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      orderBy("dateKey", "desc")
    );

    const querySnapshot = await getDocs(q);
    const nutritionHistory: DailyNutrition[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as any;

      let date = new Date();
      if (data.date instanceof Timestamp) {
        date = data.date.toDate();
      } else if (data.date) {
        date = new Date(data.date);
      }

      nutritionHistory.push({
        id: docSnap.id,
        ...data,
        date,
      } as DailyNutrition);
    });

    return { success: true, data: nutritionHistory };
  } catch (error: any) {
    console.error("[NutritionService] Error fetching nutrition history:", error);
    return { success: false, msg: error?.message };
  }
};

// Actualizează obiectivele calorice
export const updateNutritionGoals = async (
  userID: string,
  goals: {
    calorieGoal?: number;
    proteinGoal?: number;
    carbsGoal?: number;
    fatGoal?: number;
  }
): Promise<ResponseType> => {
  try {
    const dateKey = getDateKey(new Date());

    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      where("dateKey", "==", dateKey)
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
    return { success: false, msg: error?.message };
  }
};