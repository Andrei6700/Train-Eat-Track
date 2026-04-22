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
  updateDoc,
  where,
} from "firebase/firestore";
import { cacheLastWorkout, getCachedLastWorkout } from "./cacheService";
import {
  getCachedWorkoutHistory,
  removeCachedWorkoutHistoryItem,
  setCachedWorkoutHistory,
  upsertCachedWorkoutHistoryItem,
} from "./workoutHistoryCacheService";
import {
  enqueueOrMergeAction,
  getQueuedWorkoutDrafts,
  removeFromSyncQueue,
  toDateKey,
} from "./syncQueueService";

const COLLECTION_NAME = "workoutsHistory";

const isOnline = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  } catch {
    return false;
  }
};

const normalizeWorkoutDate = (value: Date | string): Date => {
  const workoutDate = new Date(value);
  if (Number.isNaN(workoutDate.getTime())) {
    const fallback = new Date();
    fallback.setHours(12, 0, 0, 0);
    return fallback;
  }

  workoutDate.setHours(12, 0, 0, 0);
  return workoutDate;
};

const parseWorkoutDoc = (docId: string, payload: any): WorkoutHistory => {
  const dateField = payload.date;
  const date =
    dateField && typeof dateField.toDate === "function"
      ? dateField.toDate()
      : dateField || null;

  return {
    id: docId,
    ...payload,
    date,
  } as WorkoutHistory;
};

const mergeQueuedAndRemoteWorkouts = (
  queued: WorkoutHistory[],
  remote: WorkoutHistory[],
): WorkoutHistory[] => {
  const queuedByDateKey = new Map<string, WorkoutHistory>();
  queued.forEach((item) => {
    queuedByDateKey.set(toDateKey(item.date as Date | string), item);
  });

  const merged: WorkoutHistory[] = [];
  const consumedKeys = new Set<string>();

  remote.forEach((item) => {
    const key = toDateKey(item.date as Date | string);
    const queuedVersion = queuedByDateKey.get(key);
    if (queuedVersion) {
      merged.push(queuedVersion);
      consumedKeys.add(key);
      return;
    }
    merged.push(item);
  });

  queued.forEach((item) => {
    const key = toDateKey(item.date as Date | string);
    if (!consumedKeys.has(key)) {
      merged.push(item);
    }
  });

  return merged.sort(
    (a, b) =>
      new Date(b.date as Date | string).getTime() -
      new Date(a.date as Date | string).getTime(),
  );
};

export const getWorkoutByUserAndDate = async (
  userID: string,
  date: Date | string,
): Promise<ResponseType> => {
  try {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      where("date", ">=", targetDate),
      where("date", "<", nextDay),
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return { success: true, data: null };
    }

    const firstDoc = querySnapshot.docs[0];
    return {
      success: true,
      data: parseWorkoutDoc(firstDoc.id, firstDoc.data()),
    };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[workoutService] Error getting workout by date:", error);
    }
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const addWorkoutRemote = async (
  workout: WorkoutHistory,
  options?: { forceOverwrite?: boolean },
): Promise<ResponseType> => {
  try {
    const workoutDate = normalizeWorkoutDate(workout.date);

    const existingResult = await getWorkoutByUserAndDate(workout.userID, workoutDate);
    if (!existingResult.success) {
      return existingResult;
    }

    if (existingResult.data) {
      if (options?.forceOverwrite) {
        const remoteWorkout = existingResult.data as WorkoutHistory;
        if (!remoteWorkout.id) {
          return {
            success: false,
            code: "UNKNOWN_ERROR",
            msg: "Workout conflict exists but remote identifier is missing.",
          };
        }

        const docRef = doc(firestore, COLLECTION_NAME, remoteWorkout.id);
        await updateDoc(docRef, {
          ...workout,
          date: Timestamp.fromDate(workoutDate),
        });

        const persistedWorkout: WorkoutHistory = {
          ...workout,
          id: remoteWorkout.id,
          date: workoutDate,
          isOffline: false,
          syncStatus: undefined,
          queuedActionId: undefined,
          savedAt: undefined,
        };

        await Promise.all([
          cacheLastWorkout(persistedWorkout),
          upsertCachedWorkoutHistoryItem(workout.userID, persistedWorkout),
        ]);

        return {
          success: true,
          data: { id: remoteWorkout.id, overwritten: true },
        };
      }

      return {
        success: false,
        code: "SYNC_CONFLICT",
        msg: "A workout already exists for this day.",
        data: {
          localSnapshot: workout,
          remoteSnapshot: existingResult.data,
        },
      };
    }

    const payload: any = {
      ...workout,
      date: Timestamp.fromDate(workoutDate),
    };

    const docRef = await addDoc(collection(firestore, COLLECTION_NAME), payload);

    const persistedWorkout: WorkoutHistory = {
      ...workout,
      id: docRef.id,
      date: workoutDate,
      isOffline: false,
      syncStatus: undefined,
      queuedActionId: undefined,
      savedAt: undefined,
    };

    await Promise.all([
      cacheLastWorkout(persistedWorkout),
      upsertCachedWorkoutHistoryItem(workout.userID, persistedWorkout),
    ]);

    return {
      success: true,
      data: { id: docRef.id },
    };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[workoutService] addWorkoutRemote error:", error);
    }
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const getUserWorkouts = async (userID: string): Promise<ResponseType> => {
  let queuedWorkouts: WorkoutHistory[] = [];
  let cachedHistory: WorkoutHistory[] = [];

  try {
    queuedWorkouts = (await getQueuedWorkoutDrafts(userID)) as WorkoutHistory[];
    const cachedHistoryResult = await getCachedWorkoutHistory(userID, {
      allowStale: true,
    });
    cachedHistory = cachedHistoryResult.data || [];

    const online = await isOnline();

    if (!online) {
      const localCollection = mergeQueuedAndRemoteWorkouts(
        queuedWorkouts,
        cachedHistory,
      );

      if (localCollection.length > 0) {
        await cacheLastWorkout(localCollection[0]);
      }
      await setCachedWorkoutHistory(userID, localCollection);

      return { success: true, data: localCollection };
    }

    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      orderBy("date", "desc"),
    );

    const querySnapshot = await getDocs(q);
    const remoteWorkouts: WorkoutHistory[] = [];

    querySnapshot.forEach((docSnap) => {
      remoteWorkouts.push(parseWorkoutDoc(docSnap.id, docSnap.data()));
    });

    const mergedWorkouts = mergeQueuedAndRemoteWorkouts(queuedWorkouts, remoteWorkouts);

    if (mergedWorkouts.length > 0) {
      await Promise.all([
        cacheLastWorkout(mergedWorkouts[0]),
        setCachedWorkoutHistory(userID, mergedWorkouts),
      ]);
    } else {
      await setCachedWorkoutHistory(userID, []);
    }

    return { success: true, data: mergedWorkouts };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[workoutService] Error fetching workouts:", error);
    }

    const fallbackFromCache = mergeQueuedAndRemoteWorkouts(
      queuedWorkouts,
      cachedHistory,
    );

    if (fallbackFromCache.length > 0) {
      return {
        success: true,
        data: fallbackFromCache,
      };
    }

    const cachedWorkout = await getCachedLastWorkout();
    if (cachedWorkout) {
      return {
        success: true,
        data: [cachedWorkout],
      };
    }

    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const checkWorkoutExistsToday = async (
  userID: string,
): Promise<ResponseType> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const queuedWorkouts = (await getQueuedWorkoutDrafts(userID)) as WorkoutHistory[];
    const hasQueuedToday = queuedWorkouts.some((workout) => {
      const workoutDate = new Date(workout.date);
      workoutDate.setHours(0, 0, 0, 0);
      return workoutDate.getTime() === today.getTime();
    });

    if (hasQueuedToday) {
      return {
        success: false,
        msg: "You already have a workout logged for today.",
        data: { exists: true },
      };
    }

    const online = await isOnline();
    if (!online) {
      return { success: true, data: { exists: false } };
    }

    const existingResult = await getWorkoutByUserAndDate(userID, today);
    if (!existingResult.success) {
      return { success: true, data: { exists: false } };
    }

    if (existingResult.data) {
      return {
        success: false,
        msg: "You already have a workout logged for today.",
        data: { exists: true },
      };
    }

    return { success: true, data: { exists: false } };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[workoutService] Error checking workout for today:", error);
    }
    return { success: true, data: { exists: false } };
  }
};

export const getLastWeekWorkout = async (
  userID: string,
  _dayName: string,
): Promise<ResponseType> => {
  try {
    const online = await isOnline();

    if (!online) {
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
      const firstDoc = querySnapshot.docs[0];
      return {
        success: true,
        data: parseWorkoutDoc(firstDoc.id, firstDoc.data()),
      };
    }

    return { success: true, data: null };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[workoutService] Error getting last week workout:", error);
    }
    const cachedWorkout = await getCachedLastWorkout();
    if (cachedWorkout) {
      return { success: true, data: cachedWorkout };
    }
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const addWorkout = async (
  workout: WorkoutHistory,
): Promise<ResponseType> => {
  try {
    const online = await isOnline();
    const workoutDate = normalizeWorkoutDate(workout.date);
    const dedupeKey = `${workout.userID}:${toDateKey(workoutDate)}`;

    if (!online) {
      const queuedAction = await enqueueOrMergeAction({
        type: "ADD_WORKOUT",
        data: {
          ...workout,
          date: workoutDate,
        },
        dedupeKey,
        mergeStrategy: "replace_latest",
      });

      await cacheLastWorkout({
        ...workout,
        id: `offline_${queuedAction.id}`,
        date: workoutDate,
        isOffline: true,
        syncStatus: "pending",
        queuedActionId: queuedAction.id,
        savedAt: queuedAction.timestamp,
      });

      await upsertCachedWorkoutHistoryItem(workout.userID, {
        ...workout,
        id: `offline_${queuedAction.id}`,
        date: workoutDate,
        isOffline: true,
        syncStatus: "pending",
        queuedActionId: queuedAction.id,
        savedAt: queuedAction.timestamp,
      });

      return {
        success: true,
        data: { id: `offline_${queuedAction.id}`, offline: true },
        code: "SYNC_QUEUED_OFFLINE",
        msg: "Workout saved offline. Will sync when online.",
      };
    }

    const remoteResult = await addWorkoutRemote({
      ...workout,
      date: workoutDate,
    });

    if (remoteResult.success) {
      return remoteResult;
    }

    if (remoteResult.code === "SYNC_CONFLICT") {
      return remoteResult;
    }

    const queuedAction = await enqueueOrMergeAction({
      type: "ADD_WORKOUT",
      data: {
        ...workout,
        date: workoutDate,
      },
      dedupeKey,
      mergeStrategy: "replace_latest",
    });

    await upsertCachedWorkoutHistoryItem(workout.userID, {
      ...workout,
      id: `offline_${queuedAction.id}`,
      date: workoutDate,
      isOffline: true,
      syncStatus: "retry_scheduled",
      queuedActionId: queuedAction.id,
      savedAt: queuedAction.timestamp,
    });

    return {
      success: true,
      data: { id: `offline_${queuedAction.id}`, offline: true },
      code: "SYNC_RETRY_SCHEDULED",
      msg: "Workout saved locally due to a temporary sync issue.",
    };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[workoutService] Error adding workout:", error);
    }

    const queuedAction = await enqueueOrMergeAction({
      type: "ADD_WORKOUT",
      data: workout,
      dedupeKey: `${workout.userID}:${toDateKey(workout.date as Date | string)}`,
      mergeStrategy: "replace_latest",
    });

    return {
      success: true,
      data: { id: `offline_${queuedAction.id}`, offline: true },
      code: "SYNC_RETRY_SCHEDULED",
      msg: "Workout saved offline due to error. Will sync when possible.",
    };
  }
};

export const getWorkout = async (workoutId: string): Promise<ResponseType> => {
  try {
    if (workoutId.startsWith("offline_")) {
      const queuedWorkouts = (await getQueuedWorkoutDrafts()) as WorkoutHistory[];
      const workout = queuedWorkouts.find((entry) => entry.id === workoutId);
      if (workout) {
        return { success: true, data: workout };
      }
      return { success: false, msg: "Offline workout not found", code: "UNKNOWN_ERROR" };
    }

    const docRef = doc(firestore, COLLECTION_NAME, workoutId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, msg: "Workout not found", code: "UNKNOWN_ERROR" };
    }

    return {
      success: true,
      data: parseWorkoutDoc(docSnap.id, docSnap.data()),
    };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[workoutService] Error getting workout:", error);
    }
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const deleteWorkout = async (
  workoutId: string,
): Promise<ResponseType> => {
  try {
    if (workoutId.startsWith("offline_")) {
      const actionId = workoutId.replace("offline_", "");
      const queuedWorkoutResult = await getWorkout(workoutId);
      await removeFromSyncQueue(actionId);

      const queuedWorkout = queuedWorkoutResult.success
        ? (queuedWorkoutResult.data as WorkoutHistory)
        : null;
      if (queuedWorkout?.userID) {
        await removeCachedWorkoutHistoryItem(queuedWorkout.userID, workoutId);
      }
      return { success: true, msg: "Offline workout deleted" };
    }

    const existingWorkoutResult = await getWorkout(workoutId);
    await deleteDoc(doc(firestore, COLLECTION_NAME, workoutId));

    const existingWorkout = existingWorkoutResult.success
      ? (existingWorkoutResult.data as WorkoutHistory)
      : null;
    if (existingWorkout?.userID) {
      await removeCachedWorkoutHistoryItem(existingWorkout.userID, workoutId);
    }
    return { success: true, msg: "Workout deleted successfully" };
  } catch (error: any) {
    if (__DEV__) {
      console.error("[workoutService] Error deleting workout:", error);
    }
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const prefetchWorkoutHistorySnapshot = async (
  userID: string,
): Promise<void> => {
  try {
    await getUserWorkouts(userID);
  } catch (error) {
    if (__DEV__) {
      console.error("[workoutService] Prefetch workout history failed:", error);
    }
  }
};
