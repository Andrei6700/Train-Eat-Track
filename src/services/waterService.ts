import { firestore } from "@/src/config/firebase";
import { DailyWater, ResponseType } from '@/src/types/index';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from "firebase/firestore";

const COLLECTION_NAME = "waterTracking";

//  helper for  normalizing date to midnight
const normalizeDate = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

//  helper for creating consistent document ID
const getDateKey = (date: Date): string => {
  const normalized = normalizeDate(date);
  return `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, '0')}-${String(normalized.getDate()).padStart(2, '0')}`;
};

export const getDailyWater = async (
  userID: string,
  date: Date
): Promise<ResponseType> => {
  try {
    const dateKey = getDateKey(date);
    
    console.log('[WaterService] Searching for dateKey:', dateKey);

    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      where("dateKey", "==", dateKey)
    );

    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docData = querySnapshot.docs[0];
      const data = docData.data() as any;
      
      console.log('[WaterService] Found existing document:', docData.id);
      
      // Convert date field from Timestamp to Date
      let waterDate = date;
      if (data.date) {
        waterDate = data.date instanceof Timestamp 
          ? data.date.toDate() 
          : new Date(data.date);
      }

      // Convert timestamps in intakes
      const intakes = data.intakes?.map((intake: any) => ({
        amount: intake.amount,
        timestamp: intake.timestamp instanceof Timestamp 
          ? intake.timestamp.toDate() 
          : new Date(intake.timestamp)
      })) || [];

      return {
        success: true,
        data: {
          id: docData.id,
          ...data,
          date: waterDate,
          intakes,
        } as DailyWater,
      };
    }

    console.log('[WaterService] No document found for dateKey:', dateKey);
    
    return {
      success: true,
      data: null,
    };
  } catch (error: any) {
    console.error("[WaterService] Error fetching daily water:", error);
    return { success: false, msg: error?.message };
  }
};

export const saveDailyWater = async (
  water: DailyWater
): Promise<ResponseType> => {
  try {
    const dateKey = getDateKey(new Date(water.date));
    
    // Convert timestamps in intakes for Firestore
    const intakesForFirestore = water.intakes.map(intake => ({
      amount: intake.amount,
      timestamp: Timestamp.fromDate(new Date(intake.timestamp))
    }));
    
    if (water.id) {
      //  UPDATE
      console.log('[WaterService] Updating document:', water.id);
      
      const docRef = doc(firestore, COLLECTION_NAME, water.id);
      const { id, ...updateData } = water;
      
      await updateDoc(docRef, {
        ...updateData,
        dateKey,
        date: Timestamp.fromDate(new Date(water.date)),
        intakes: intakesForFirestore,
        updatedAt: serverTimestamp(),
      });
      
      return { success: true, msg: "Water tracking updated successfully" };
    } else {
      //  CREATE
      console.log('[WaterService] Creating new document for dateKey:', dateKey);
      
      const docRef = await addDoc(collection(firestore, COLLECTION_NAME), {
        ...water,
        dateKey,
        date: Timestamp.fromDate(new Date(water.date)),
        intakes: intakesForFirestore,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      console.log('[WaterService] Document created with ID:', docRef.id);
      
      return { success: true, data: { id: docRef.id } };
    }
  } catch (error: any) {
    console.error("[WaterService] Error saving daily water:", error);
    return { success: false, msg: error?.message };
  }
};