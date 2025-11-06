import { firestore } from "@/src/config/firebase";
import { DailyWater, ResponseType } from '@/src/types/index';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";

const COLLECTION_NAME = "waterTracking";

export const getDailyWater = async (
  userID: string,
  date: Date
): Promise<ResponseType> => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      where("date", ">=", startOfDay),
      where("date", "<=", endOfDay)
    );

    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data() as any;
      const dateField = data.date;
      const waterDate = dateField && typeof (dateField as any).toDate === "function"
        ? (dateField as any).toDate()
        : dateField || null;

      return {
        success: true,
        data: {
          id: doc.id,
          ...data,
          date: waterDate,
        } as DailyWater,
      };
    }

    return {
      success: true,
      data: {
        userID,
        date,
        goal: 2000,
        intakes: [],
        total: 0,
      } as DailyWater,
    };
  } catch (error: any) {
    console.log("Error fetching daily water:", error);
    return { success: false, msg: error?.message };
  }
};

export const saveDailyWater = async (
  water: DailyWater
): Promise<ResponseType> => {
  try {
    if (water.id) {
      const docRef = doc(firestore, COLLECTION_NAME, water.id);
      const { id, ...updateData } = water;
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
      return { success: true, msg: "Water tracking updated successfully" };
    } else {
      const docRef = await addDoc(collection(firestore, COLLECTION_NAME), {
        ...water,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { success: true, data: { id: docRef.id } };
    }
  } catch (error: any) {
    console.log("Error saving daily water:", error);
    return { success: false, msg: error?.message };
  }
};