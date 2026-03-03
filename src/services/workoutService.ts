import { firestore } from "@/src/config/firebase";
import { ResponseType, WorkoutHistory } from "@/src/types/index";
import NetInfo from "@react-native-community/netinfo";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { cacheLastWorkout, getCachedLastWorkout } from "./cacheService";
import {
  addToSyncQueue,
  getOfflineWorkouts,
  saveOfflineWorkout,
} from "./syncQueueService";

const COLLECTION_NAME = "workoutsHistory";

// Check if we are online
const isOnline = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  } catch {
    return false;
  }
};

// Get all workouts for a user
export const getUserWorkouts = async (
  userID: string,
): Promise<ResponseType> => {
  try {
    console.log("[workoutService] getUserWorkouts userID:", userID);

    const online = await isOnline();

    if (!online) {
      // Offline - return from cache + offline workouts
      console.log("[workoutService] Offline - using cached data");
      const cachedWorkout = await getCachedLastWorkout();
      const offlineWorkouts = await getOfflineWorkouts();

      const allWorkouts = [
        ...offlineWorkouts,
        ...(cachedWorkout ? [cachedWorkout] : []),
      ];

      return { success: true, data: allWorkouts };
    }

    // Online - load from Firebase
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      orderBy("date", "desc"),
    );

    const querySnapshot = await getDocs(q);
    const workouts: WorkoutHistory[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const dateField = data.date;
      const date =
        dateField && typeof (dateField as any).toDate === "function"
          ? (dateField as any).toDate()
          : dateField || null;

      workouts.push({
        id: docSnap.id,
        ...data,
        date,
      } as WorkoutHistory);
    });

    // Save last workout in cache
    if (workouts.length > 0) {
      await cacheLastWorkout(workouts[0]);
    }

    // Add offline workouts
    const offlineWorkouts = await getOfflineWorkouts();
    const allWorkouts = [...offlineWorkouts, ...workouts];

    console.log("[workoutService] getUserWorkouts found:", allWorkouts.length);
    return { success: true, data: allWorkouts };
  } catch (error: any) {
    console.log("Error fetching workouts:", error);

    // Fallback to cache + offline
    const cachedWorkout = await getCachedLastWorkout();
    const offlineWorkouts = await getOfflineWorkouts();

    if (cachedWorkout || offlineWorkouts.length > 0) {
      console.log("[workoutService] Using cached/offline data as fallback");
      return {
        success: true,
        data: [...offlineWorkouts, ...(cachedWorkout ? [cachedWorkout] : [])],
      };
    }

    return { success: false, msg: error?.message };
  }
};

// Check if a workout already exists for the current day
export const checkWorkoutExistsToday = async (
  userID: string,
): Promise<ResponseType> => {
  try {
    const online = await isOnline();

    // Check also in offline workouts
    const offlineWorkouts = await getOfflineWorkouts();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const hasOfflineToday = offlineWorkouts.some((w) => {
      const workoutDate = new Date(w.date || w.savedAt);
      workoutDate.setHours(0, 0, 0, 0);
      return workoutDate.getTime() === today.getTime() && w.userID === userID;
    });

    if (hasOfflineToday) {
      return {
        success: false,
        msg: "You already have a workout logged for today.",
        data: { exists: true },
      };
    }

    if (!online) {
      return { success: true, data: { exists: false } };
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      where("date", ">=", today),
      where("date", "<", tomorrow),
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return {
        success: false,
        msg: "You already have a workout logged for today.",
        data: { exists: true },
      };
    }

    return { success: true, data: { exists: false } };
  } catch (error: any) {
    console.log("Error checking existing workout:", error);
    return { success: true, data: { exists: false } }; // Allow save in case of error
  }
};

// Get last week's workout for the specified day
export const getLastWeekWorkout = async (
  userID: string,
  dayName: string,
): Promise<ResponseType> => {
  try {
    console.log(
      "[workoutService] getLastWeekWorkout userID:",
      userID,
      "dayName:",
      dayName,
    );

    const online = await isOnline();

    if (!online) {
      // Offline - return from cache
      const cachedWorkout = await getCachedLastWorkout();
      if (cachedWorkout) {
        return { success: true, data: cachedWorkout };
      }
      return { success: true, data: null };
    }

    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);

    const startOfDay = new Date(lastWeek);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(lastWeek);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      where("date", ">=", startOfDay),
      where("date", "<=", endOfDay),
      orderBy("date", "desc"),
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data() as any;
      const dateField = data.date;
      const date =
        dateField && typeof (dateField as any).toDate === "function"
          ? (dateField as any).toDate()
          : dateField || null;

      const workout = {
        id: doc.id,
        ...data,
        date,
      } as WorkoutHistory;

      return { success: true, data: workout };
    }

    return { success: true, data: null };
  } catch (error: any) {
    console.log("Error getting last week workout:", error);
    // Fallback to cache
    const cachedWorkout = await getCachedLastWorkout();
    if (cachedWorkout) {
      return { success: true, data: cachedWorkout };
    }
    return { success: false, msg: error?.message };
  }
};

// ADD WORKOUT WITH OFFLINE SUPPORT - CRITICAL FIX FOR HISTORICAL DATES
export const addWorkout = async (
  workout: WorkoutHistory,
): Promise<ResponseType> => {
  try {
    console.log(
      "[workoutService] addWorkout payload:",
      JSON.stringify(workout),
    );

    const online = await isOnline();

    if (!online) {
      // OFFLINE - Save locally
      console.log("[workoutService] Offline - saving locally");
      await saveOfflineWorkout(workout);

      // Add to sync queue
      await addToSyncQueue({
        type: "ADD_WORKOUT",
        data: workout,
      });

      // Update cache
      const offlineWorkout = {
        ...workout,
        id: `offline_${Date.now()}`,
        date: workout.date || new Date(),
        isOffline: true,
      };
      await cacheLastWorkout(offlineWorkout);

      return {
        success: true,
        data: { id: offlineWorkout.id, offline: true },
        msg: "Workout saved offline. Will sync when online.",
      };
    }

    // ONLINE - Save to Firebase
    // CRITICAL FIX: Use the exact date provided in workout object
    // This ensures historical workouts are saved with the correct date
    const workoutDate = new Date(workout.date);

    // Normalize to avoid timezone issues - set to noon
    workoutDate.setHours(12, 0, 0, 0);

    const payload: any = {
      ...workout,
      date: Timestamp.fromDate(workoutDate), // Use Timestamp with the exact date
    };

    console.log(
      "[workoutService] Saving with date:",
      workoutDate.toISOString(),
    );

    const docRef = await addDoc(
      collection(firestore, COLLECTION_NAME),
      payload,
    );
    console.log("[workoutService] created doc id:", docRef.id);

    // Update cache
    const newWorkout = {
      ...workout,
      id: docRef.id,
      date: workoutDate,
    };
    await cacheLastWorkout(newWorkout);

    return { success: true, data: { id: docRef.id } };
  } catch (error: any) {
    console.log("Error adding workout:", error);

    // FALLBACK - Save offline in case of error
    console.log("[workoutService] Error - saving offline as fallback");
    await saveOfflineWorkout(workout);
    await addToSyncQueue({
      type: "ADD_WORKOUT",
      data: workout,
    });

    return {
      success: true,
      data: { id: `offline_${Date.now()}`, offline: true },
      msg: "Workout saved offline due to error. Will sync when possible.",
    };
  }
};

export const getWorkout = async (workoutId: string): Promise<ResponseType> => {
  try {
    // Check if it's an offline workout
    if (workoutId.startsWith("offline_")) {
      const offlineWorkouts = await getOfflineWorkouts();
      const workout = offlineWorkouts.find((w) => w.id === workoutId);
      if (workout) {
        return { success: true, data: workout };
      }
      return { success: false, msg: "Offline workout not found" };
    }

    console.log("[workoutService] getWorkout id:", workoutId);
    const docRef = doc(firestore, COLLECTION_NAME, workoutId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as any;
      const dateField = data.date;
      const date =
        dateField && typeof (dateField as any).toDate === "function"
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

export const deleteWorkout = async (
  workoutId: string,
): Promise<ResponseType> => {
  try {
    // Check if it's an offline workout
    if (workoutId.startsWith("offline_")) {
      const { removeOfflineWorkout } = await import("./syncQueueService");
      await removeOfflineWorkout(workoutId);
      return { success: true, msg: "Offline workout deleted" };
    }

    console.log("[workoutService] deleteWorkout id:", workoutId);
    await deleteDoc(doc(firestore, COLLECTION_NAME, workoutId));
    return { success: true, msg: "Workout deleted successfully" };
  } catch (error: any) {
    console.log("Error deleting workout:", error);
    return { success: false, msg: error?.message };
  }
};
