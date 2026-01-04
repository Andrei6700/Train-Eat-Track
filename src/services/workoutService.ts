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
  serverTimestamp,
  where
} from "firebase/firestore";

const COLLECTION_NAME = "workoutsHistory";

// ia toate workout-urile unui user
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

// verifica daca exista deja un workout pentru ziua curenta
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

// ia workout-ul de acum o saptamana pentru ziua specificata
export const getLastWeekWorkout = async (userID: string, dayName: string): Promise<ResponseType> => {
  try {
    console.log("[workoutService] getLastWeekWorkout userID:", userID, "dayName:", dayName);

    // calculeaza data de acum 7 zile
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    
    // intervalul de timp pentru ziua respectiva acum o saptamana
    const startOfDay = new Date(lastWeek);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(lastWeek);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      where("date", ">=", startOfDay),
      where("date", "<=", endOfDay),
      orderBy("date", "desc")
    );

    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data() as any;
      const dateField = data.date;
      const date = dateField && typeof (dateField as any).toDate === "function"
        ? (dateField as any).toDate()
        : dateField || null;

      const workout = {
        id: doc.id,
        ...data,
        date,
      } as WorkoutHistory;

      console.log("[workoutService] found last week workout:", workout.id);
      return { success: true, data: workout };
    }

    console.log("[workoutService] no workout found for last week");
    return { success: true, data: null };
  } catch (error: any) {
    console.log("Error getting last week workout:", error);
    return { success: false, msg: error?.message };
  }
};

export const addWorkout = async (workout: WorkoutHistory): Promise<ResponseType> => {
  try {
    console.log("[workoutService] addWorkout payload:", JSON.stringify(workout));

    //  Verifica daca exista deja un workout azi
    const existsCheck = await checkWorkoutExistsToday(workout.userID);
    if (!existsCheck.success) {
      return existsCheck; 
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