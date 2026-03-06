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

const toMillis = (value: any): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && typeof value.toDate === "function") {
    const converted = value.toDate();
    return converted instanceof Date ? converted.getTime() : 0;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const getPlannedExercisesCount = (plan: WorkoutPlan): number => {
  if (!Array.isArray(plan.days)) return 0;

  return plan.days.reduce((total, day) => {
    if (day?.isRestDay) return total;
    return total + (Array.isArray(day?.exercises) ? day.exercises.length : 0);
  }, 0);
};

const pickBestWorkoutPlan = (plans: WorkoutPlan[]): WorkoutPlan | null => {
  if (plans.length === 0) return null;

  const sortedPlans = [...plans].sort((a, b) => {
    const aHasExercises = getPlannedExercisesCount(a) > 0 ? 1 : 0;
    const bHasExercises = getPlannedExercisesCount(b) > 0 ? 1 : 0;

    if (bHasExercises !== aHasExercises) {
      return bHasExercises - aHasExercises;
    }

    const aUpdatedAt = toMillis(a.updatedAt) || toMillis(a.createdAt);
    const bUpdatedAt = toMillis(b.updatedAt) || toMillis(b.createdAt);
    if (bUpdatedAt !== aUpdatedAt) {
      return bUpdatedAt - aUpdatedAt;
    }

    const aCreatedAt = toMillis(a.createdAt);
    const bCreatedAt = toMillis(b.createdAt);
    return bCreatedAt - aCreatedAt;
  });

  return sortedPlans[0] || null;
};

// take user workout plan 
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
      const plans = querySnapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as WorkoutPlan
      );
      const bestPlan = pickBestWorkoutPlan(plans);

      return {
        success: true,
        data: bestPlan,
      };
    }
    
    return { success: true, data: null };
  } catch (error: any) {
    console.log("Error fetching workout plan:", error);
    return { success: false, msg: error?.message };
  }
};

// create a new workout plan
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

// Update workout plan
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

//  DELETE: Delete workout plan and ALL workouts from history
export const deleteWorkoutPlan = async (
  planId: string,
  userID: string
): Promise<ResponseType> => {
  try {
    // 1. Delete the plan
    const planRef = doc(firestore, COLLECTION_NAME, planId);
    await deleteDoc(planRef);
    
    // 2. Delete all workouts from history for this user
    const workoutsQuery = query(
      collection(firestore, WORKOUTS_COLLECTION),
      where("userID", "==", userID)
    );
    
    const workoutsSnapshot = await getDocs(workoutsQuery);
    
    // delete each workout individually
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

// take a workout plan by ID
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
