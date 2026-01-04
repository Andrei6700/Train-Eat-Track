import { firestore } from "@/src/config/firebase";
import { ResponseType, WorkoutPlan } from '@/src/types/index';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where
} from "firebase/firestore";

const COLLECTION_NAME = "workoutPlans";
const WORKOUTS_COLLECTION = "workoutsHistory";

// ia planul de workout al user-ului
export const getUserWorkoutPlan = async (
  userID: string
): Promise<ResponseType> => {
  try {
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID)
    );

    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        success: true,
        data: { id: doc.id, ...doc.data() } as WorkoutPlan,
      };
    }
    
    return { success: true, data: null };
  } catch (error: any) {
    console.log("Error fetching workout plan:", error);
    return { success: false, msg: error?.message };
  }
};

// Creează un plan de workout nou
export const createWorkoutPlan = async (
  plan: WorkoutPlan
): Promise<ResponseType> => {
  try {
    const docRef = await addDoc(collection(firestore, COLLECTION_NAME), {
      ...plan,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { success: true, data: { id: docRef.id } };
  } catch (error: any) {
    console.log("Error creating workout plan:", error);
    return { success: false, msg: error?.message };
  }
};

// Actualizează planul de workout
export const updateWorkoutPlan = async (
  planId: string,
  updates: Partial<WorkoutPlan>
): Promise<ResponseType> => {
  try {
    const planRef = doc(firestore, COLLECTION_NAME, planId);
    await updateDoc(planRef, {
      ...updates,
      updatedAt: new Date(),
    });

    return { success: true, msg: "Workout plan updated successfully" };
  } catch (error: any) {
    console.log("Error updating workout plan:", error);
    return { success: false, msg: error?.message };
  }
};

// ✅ MODIFICAT: Șterge planul și TOATE workout-urile din history
export const deleteWorkoutPlan = async (
  planId: string,
  userID: string
): Promise<ResponseType> => {
  try {
    // 1. Șterge planul
    const planRef = doc(firestore, COLLECTION_NAME, planId);
    await deleteDoc(planRef);
    
    // 2. Șterge toate workout-urile din history pentru acest user
    const workoutsQuery = query(
      collection(firestore, WORKOUTS_COLLECTION),
      where("userID", "==", userID)
    );
    
    const workoutsSnapshot = await getDocs(workoutsQuery);
    
    // sterge fiecare workout în parte
    const deletePromises = workoutsSnapshot.docs.map(workoutDoc => 
      deleteDoc(doc(firestore, WORKOUTS_COLLECTION, workoutDoc.id))
    );
    
    await Promise.all(deletePromises);
    
    console.log(`Deleted workout plan and ${workoutsSnapshot.size} workouts from history`);
    
    return { 
      success: true, 
      msg: `Workout plan and ${workoutsSnapshot.size} workout(s) deleted successfully` 
    };
  } catch (error: any) {
    console.log("Error deleting workout plan:", error);
    return { success: false, msg: error?.message };
  }
};

// ia un plan de workout după ID
export const getWorkoutPlan = async (
  planId: string
): Promise<ResponseType> => {
  try {
    const docRef = doc(firestore, COLLECTION_NAME, planId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        success: true,
        data: { id: docSnap.id, ...docSnap.data() } as WorkoutPlan,
      };
    } else {
      return { success: false, msg: "Workout plan not found" };
    }
  } catch (error: any) {
    console.log("Error getting workout plan:", error);
    return { success: false, msg: error?.message };
  }
};