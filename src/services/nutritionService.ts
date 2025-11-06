import { firestore } from "@/src/config/firebase";
import { DailyNutrition, ResponseType } from '@/src/types/index';
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where
} from "firebase/firestore";

const COLLECTION_NAME = "nutrition";

// Obține datele nutriționale pentru o zi specifică
export const getDailyNutrition = async (
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
      const nutritionDate = dateField && typeof (dateField as any).toDate === "function"
        ? (dateField as any).toDate()
        : dateField || null;

      return {
        success: true,
        data: {
          id: doc.id,
          ...data,
          date: nutritionDate,
        } as DailyNutrition,
      };
    }

    // Dacă nu există, creează o structură goală
    return {
      success: true,
      data: {
        userID,
        date,
        calorieGoal: 2500,
        proteinGoal: 150,
        carbsGoal: 250,
        fatGoal: 70,
        meals: [
          { mealName: "Mic Dejun", foods: [] },
          { mealName: "Pranz", foods: [] },
          { mealName: "Cina", foods: [] },
          { mealName: "Gustari", foods: [] },
        ],
      } as DailyNutrition,
    };
  } catch (error: any) {
    console.log("Error fetching daily nutrition:", error);
    return { success: false, msg: error?.message };
  }
};

// Salvează sau actualizează datele nutriționale zilnice
export const saveDailyNutrition = async (
  nutrition: DailyNutrition
): Promise<ResponseType> => {
  try {
    if (nutrition.id) {
      // Actualizare
      const docRef = doc(firestore, COLLECTION_NAME, nutrition.id);
      const { id, ...updateData } = nutrition;
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
      return { success: true, msg: "Nutrition updated successfully" };
    } else {
      // Creare nouă
      const docRef = await addDoc(collection(firestore, COLLECTION_NAME), {
        ...nutrition,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { success: true, data: { id: docRef.id } };
    }
  } catch (error: any) {
    console.log("Error saving daily nutrition:", error);
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
      orderBy("date", "desc")
    );

    const querySnapshot = await getDocs(q);
    const nutritionHistory: DailyNutrition[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const dateField = data.date;
      const date = dateField && typeof (dateField as any).toDate === "function"
        ? (dateField as any).toDate()
        : dateField || null;

      nutritionHistory.push({
        id: docSnap.id,
        ...data,
        date,
      } as DailyNutrition);
    });

    return { success: true, data: nutritionHistory };
  } catch (error: any) {
    console.log("Error fetching nutrition history:", error);
    return { success: false, msg: error?.message };
  }
};

// Șterge un aliment dintr-o masă
export const deleteFoodFromMeal = async (
  nutritionId: string,
  mealName: string,
  foodIndex: number
): Promise<ResponseType> => {
  try {
    const docRef = doc(firestore, COLLECTION_NAME, nutritionId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, msg: "Nutrition record not found" };
    }

    const data = docSnap.data() as DailyNutrition;
    const meals = data.meals.map(meal => {
      if (meal.mealName === mealName) {
        return {
          ...meal,
          foods: meal.foods.filter((_, index) => index !== foodIndex),
        };
      }
      return meal;
    });

    await updateDoc(docRef, {
      meals,
      updatedAt: serverTimestamp(),
    });

    return { success: true, msg: "Food deleted successfully" };
  } catch (error: any) {
    console.log("Error deleting food:", error);
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
    // Găsește documentul pentru ziua curentă
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      where("date", ">=", startOfDay),
      where("date", "<=", endOfDay)
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
    console.log("Error updating goals:", error);
    return { success: false, msg: error?.message };
  }
};