import { firestore } from "@/src/config/firebase";
import { ResponseType, WorkoutHistory } from '@/src/types/index';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    where
} from "firebase/firestore";

const COLLECTION_NAME = "workoutsHistory";

// Obține toate workout-urile unui user
export const getUserWorkouts = async (
  userID: string
): Promise<ResponseType> => {
  try {
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      orderBy("date", "desc")
    );

    const querySnapshot = await getDocs(q);
    const workouts: WorkoutHistory[] = [];

    querySnapshot.forEach((doc) => {
      workouts.push({
        id: doc.id,
        ...doc.data(),
      } as WorkoutHistory);
    });

    return { success: true, data: workouts };
  } catch (error: any) {
    console.log("Error fetching workouts:", error);
    return { success: false, msg: error?.message };
  }
};

// Adaugă un workout nou
export const addWorkout = async (
  workout: WorkoutHistory
): Promise<ResponseType> => {
  try {
    const docRef = await addDoc(collection(firestore, COLLECTION_NAME), {
      ...workout,
      date: new Date(workout.date),
    });

    return { success: true, data: { id: docRef.id } };
  } catch (error: any) {
    console.log("Error adding workout:", error);
    return { success: false, msg: error?.message };
  }
};

// Obține un workout specific
export const getWorkout = async (
  workoutId: string
): Promise<ResponseType> => {
  try {
    const docRef = doc(firestore, COLLECTION_NAME, workoutId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        success: true,
        data: { id: docSnap.id, ...docSnap.data() } as WorkoutHistory,
      };
    } else {
      return { success: false, msg: "Workout not found" };
    }
  } catch (error: any) {
    console.log("Error getting workout:", error);
    return { success: false, msg: error?.message };
  }
};

// Șterge un workout
export const deleteWorkout = async (
  workoutId: string
): Promise<ResponseType> => {
  try {
    await deleteDoc(doc(firestore, COLLECTION_NAME, workoutId));
    return { success: true, msg: "Workout deleted successfully" };
  } catch (error: any) {
    console.log("Error deleting workout:", error);
    return { success: false, msg: error?.message };
  }
};