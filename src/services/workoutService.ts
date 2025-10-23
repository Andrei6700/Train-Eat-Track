import { firestore } from "@/src/config/firebase";
import { ResponseType, WorkoutHistory } from '@/src/types/index';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  endAt,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  startAt,
  where
} from "firebase/firestore";

const COLLECTION_NAME = "workoutsHistory";

export const getUserWorkouts = async (userID: string): Promise<ResponseType> => {
  try {
    console.log("[workoutService] getUserWorkouts userID:", userID);
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      orderBy("date", "desc")
    );

    const querySnapshot = await getDocs(q);
    const workouts: WorkoutHistory[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const dateField = data.date;
      const date = dateField && typeof (dateField as any).toDate === "function"
        ? (dateField as any).toDate()
        : dateField || null;

      workouts.push({
        id: docSnap.id,
        ...data,
        date,
      } as WorkoutHistory);
    });

    console.log("[workoutService] getUserWorkouts found:", workouts.length);
    return { success: true, data: workouts };
  } catch (error: any) {
    console.log("Error fetching workouts:", error);
    return { success: false, msg: error?.message };
  }
};

// NOUĂ FUNCȚIE: Verifică dacă există deja workout în ziua respectivă
export const checkWorkoutExistsToday = async (userID: string): Promise<ResponseType> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      where("date", ">=", today),
      where("date", "<", tomorrow)
    );

    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return { 
        success: false, 
        msg: "You already have a workout logged for today. You can only log one workout per day.",
        data: { exists: true }
      };
    }

    return { success: true, data: { exists: false } };
  } catch (error: any) {
    console.log("Error checking existing workout:", error);
    return { success: false, msg: error?.message };
  }
};

export const addWorkout = async (workout: WorkoutHistory): Promise<ResponseType> => {
  try {
    console.log("[workoutService] addWorkout payload:", JSON.stringify(workout));

    // VALIDARE: Verifică dacă există deja un workout azi
    const existsCheck = await checkWorkoutExistsToday(workout.userID);
    if (!existsCheck.success) {
      return existsCheck; // Returnează eroarea
    }

    const payload: any = {
      ...workout,
      date: serverTimestamp(),
    };

    const docRef = await addDoc(collection(firestore, COLLECTION_NAME), payload);

    console.log("[workoutService] created doc id:", docRef.id);
    return { success: true, data: { id: docRef.id } };
  } catch (error: any) {
    console.log("Error adding workout:", error);
    return { success: false, msg: error?.message };
  }
};

export const getWorkout = async (workoutId: string): Promise<ResponseType> => {
  try {
    console.log("[workoutService] getWorkout id:", workoutId);
    const docRef = doc(firestore, COLLECTION_NAME, workoutId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as any;
      const dateField = data.date;
      const date = dateField && typeof (dateField as any).toDate === "function"
        ? (dateField as any).toDate()
        : dateField || null;

      return {
        success: true,
        data: { id: docSnap.id, ...data, date } as WorkoutHistory,
      };
    } else {
      return { success: false, msg: "Workout not found" };
    }
  } catch (error: any) {
    console.log("Error getting workout:", error);
    return { success: false, msg: error?.message };
  }
};

export const deleteWorkout = async (workoutId: string): Promise<ResponseType> => {
  try {
    console.log("[workoutService] deleteWorkout id:", workoutId);
    await deleteDoc(doc(firestore, COLLECTION_NAME, workoutId));
    return { success: true, msg: "Workout deleted successfully" };
  } catch (error: any) {
    console.log("Error deleting workout:", error);
    return { success: false, msg: error?.message };
  }
};