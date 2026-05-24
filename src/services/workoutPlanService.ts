import { firestore } from "@/src/config/firebase";
import { ResponseType, WorkoutPlan } from "@/src/types/index";
import NetInfo from "@react-native-community/netinfo";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
} from "firebase/firestore";
import { enqueueOrMergeAction } from "./syncQueueService";

const COLLECTION_NAME = "workoutPlans";
const WORKOUTS_COLLECTION = "workoutsHistory";

const isOnline = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  } catch {
    return false;
  }
};

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

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  if (value && typeof value.toDate === "function") {
    const converted = value.toDate();
    if (converted instanceof Date) return converted;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
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
    if (bHasExercises !== aHasExercises) return bHasExercises - aHasExercises;
    const aUpdatedAt = toMillis(a.updatedAt) || toMillis(a.createdAt);
    const bUpdatedAt = toMillis(b.updatedAt) || toMillis(b.createdAt);
    if (bUpdatedAt !== aUpdatedAt) return bUpdatedAt - aUpdatedAt;
    return toMillis(b.createdAt) - toMillis(a.createdAt);
  });
  return sortedPlans[0] || null;
};

const parseWorkoutPlanDoc = (docId: string, payload: any): WorkoutPlan => ({
  id: docId,
  ...payload,
  createdAt: toDate(payload.createdAt),
  updatedAt: toDate(payload.updatedAt),
});

/** User-scoped workoutPlans subcollection */
const userPlanCol = (userID: string) =>
  collection(firestore, "users", userID, COLLECTION_NAME);

/** Doc ref in user-scoped workoutPlans subcollection */
const userPlanDoc = (userID: string, docId: string) =>
  doc(firestore, "users", userID, COLLECTION_NAME, docId);

/** User-scoped workoutsHistory subcollection */
const userWorkoutHistoryCol = (userID: string) =>
  collection(firestore, "users", userID, WORKOUTS_COLLECTION);

/** Doc ref in user-scoped workoutsHistory subcollection */
const userWorkoutHistoryDoc = (userID: string, docId: string) =>
  doc(firestore, "users", userID, WORKOUTS_COLLECTION, docId);

export const getUserWorkoutPlan = async (userID: string): Promise<ResponseType> => {
  try {
    const q = query(userPlanCol(userID));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const plans = querySnapshot.docs.map((docSnap) => parseWorkoutPlanDoc(docSnap.id, docSnap.data()));
      const bestPlan = pickBestWorkoutPlan(plans);
      return { success: true, data: bestPlan };
    }
    return { success: true, data: null };
  } catch (error: any) {
    if (__DEV__) console.log("Error fetching workout plan:", error);
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const createWorkoutPlanRemote = async (plan: WorkoutPlan): Promise<ResponseType> => {
  try {
    const userID = plan.userID;
    if (!userID) return { success: false, msg: "Missing userID", code: "UNKNOWN_ERROR" };
    const { userID: _uid, ...planData } = plan;
    const docRef = await addDoc(userPlanCol(userID), {
      ...planData,
      createdAt: plan.createdAt ? toDate(plan.createdAt) : new Date(),
      updatedAt: new Date(),
    });
    return { success: true, data: { id: docRef.id } };
  } catch (error: any) {
    if (__DEV__) console.log("Error creating workout plan:", error);
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const updateWorkoutPlanRemote = async (
  planId: string, updates: Partial<WorkoutPlan>,
): Promise<ResponseType> => {
  try {
    const userID = updates.userID;
    if (!userID) return { success: false, msg: "Missing userID for plan update", code: "UNKNOWN_ERROR" };
    const planRef = userPlanDoc(userID, planId);
    const { userID: _uid, ...updateData } = updates;
    await updateDoc(planRef, { ...updateData, updatedAt: new Date() });
    return { success: true, msg: "Workout plan updated successfully" };
  } catch (error: any) {
    if (__DEV__) console.log("Error updating workout plan:", error);
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const upsertWorkoutPlanRemote = async (plan: WorkoutPlan): Promise<ResponseType> => {
  const existing = await getUserWorkoutPlan(plan.userID!);
  if (!existing.success) return existing;
  if (existing.data?.id) {
    return updateWorkoutPlanRemote(existing.data.id, { ...plan, id: existing.data.id });
  }
  return createWorkoutPlanRemote(plan);
};

export const createWorkoutPlan = async (plan: WorkoutPlan): Promise<ResponseType> => {
  const online = await isOnline();
  const baseUpdatedAt = toMillis(plan.updatedAt);
  if (!online) {
    await enqueueOrMergeAction({ type: "UPSERT_WORKOUT_PLAN", data: { plan }, dedupeKey: `${plan.userID}:workout_plan`, baseUpdatedAt, mergeStrategy: "replace_latest" });
    return { success: true, code: "SYNC_QUEUED_OFFLINE", msg: "Workout plan saved locally and queued for sync." };
  }
  const remote = await createWorkoutPlanRemote(plan);
  if (remote.success) return remote;
  await enqueueOrMergeAction({ type: "UPSERT_WORKOUT_PLAN", data: { plan }, dedupeKey: `${plan.userID}:workout_plan`, baseUpdatedAt, mergeStrategy: "replace_latest" });
  return { success: true, code: "SYNC_RETRY_SCHEDULED", msg: "Workout plan saved locally and queued for sync." };
};

export const updateWorkoutPlan = async (
  planId: string, updates: Partial<WorkoutPlan>,
): Promise<ResponseType> => {
  const userID = updates.userID;
  const online = await isOnline();
  const baseUpdatedAt = toMillis(updates.updatedAt);
  if (!online) {
    if (userID) {
      await enqueueOrMergeAction({ type: "UPSERT_WORKOUT_PLAN", data: { plan: { ...updates, id: planId } }, dedupeKey: `${userID}:workout_plan`, baseUpdatedAt, mergeStrategy: "replace_latest" });
      return { success: true, code: "SYNC_QUEUED_OFFLINE", msg: "Workout plan updated locally and queued for sync." };
    }
    return { success: false, code: "NETWORK_OFFLINE", msg: "Cannot queue workout plan update without user information." };
  }
  const remote = await updateWorkoutPlanRemote(planId, updates);
  if (remote.success) return remote;
  if (userID) {
    await enqueueOrMergeAction({ type: "UPSERT_WORKOUT_PLAN", data: { plan: { ...updates, id: planId } }, dedupeKey: `${userID}:workout_plan`, baseUpdatedAt, mergeStrategy: "replace_latest" });
    return { success: true, code: "SYNC_RETRY_SCHEDULED", msg: "Workout plan queued for retry sync." };
  }
  return remote;
};

export const deleteWorkoutPlan = async (planId: string, userID: string): Promise<ResponseType> => {
  try {
    const planRef = userPlanDoc(userID, planId);
    await deleteDoc(planRef);

    // Also delete all workouts for this user
    const workoutsQuery = query(userWorkoutHistoryCol(userID));
    const workoutsSnapshot = await getDocs(workoutsQuery);
    const deletePromises = workoutsSnapshot.docs.map((workoutDoc) =>
      deleteDoc(userWorkoutHistoryDoc(userID, workoutDoc.id)),
    );
    await Promise.all(deletePromises);
    return { success: true, msg: `Workout plan and ${workoutsSnapshot.size} workout(s) deleted successfully` };
  } catch (error: any) {
    if (__DEV__) console.log("Error deleting workout plan:", error);
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const getWorkoutPlan = async (planId: string, userID?: string): Promise<ResponseType> => {
  try {
    if (!userID) return { success: false, msg: "userID required", code: "UNKNOWN_ERROR" };
    const docRef = userPlanDoc(userID, planId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return { success: false, msg: "Workout plan not found", code: "UNKNOWN_ERROR" };
    return { success: true, data: parseWorkoutPlanDoc(docSnap.id, docSnap.data()) };
  } catch (error: any) {
    if (__DEV__) console.log("Error getting workout plan:", error);
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};
