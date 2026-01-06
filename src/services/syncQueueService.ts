import AsyncStorage from "@react-native-async-storage/async-storage";

const SYNC_QUEUE_KEY = "offline_sync_queue";
const OFFLINE_WORKOUTS_KEY = "offline_workouts";
const OFFLINE_FOODS_KEY = "offline_foods";

export type SyncActionType =
  | "ADD_WORKOUT"
  | "UPDATE_NUTRITION"
  | "ADD_FOOD"
  | "ADD_WATER"
  | "UPDATE_WORKOUT_PLAN"
  | "ADD_RECENT_FOOD";

type SyncAction = {
  id: string;
  type: SyncActionType;
  data: any;
  timestamp: number;
  retryCount: number;
};

// ==================== SYNC QUEUE ====================
export const addToSyncQueue = async (
  action: Omit<SyncAction, "id" | "timestamp" | "retryCount">
): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    const newAction: SyncAction = {
      ...action,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };
    queue.push(newAction);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    console.log(" [SyncQueue] Added to queue:", newAction.type);
  } catch (error) {
    console.error("[SyncQueue] Error adding to queue:", error);
  }
};

export const getSyncQueue = async (): Promise<SyncAction[]> => {
  try {
    const data = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("[SyncQueue] Error getting queue:", error);
    return [];
  }
};

export const removeFromSyncQueue = async (actionId: string): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    const filteredQueue = queue.filter((action) => action.id !== actionId);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filteredQueue));
  } catch (error) {
    console.error("[SyncQueue] Error removing from queue:", error);
  }
};

export const clearSyncQueue = async (): Promise<void> => {
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
};

export const processSyncQueue = async (handlers: {
  ADD_WORKOUT?: (data: any) => Promise<boolean>;
  UPDATE_NUTRITION?: (data: any) => Promise<boolean>;
  ADD_FOOD?: (data: any) => Promise<boolean>;
  ADD_WATER?: (data: any) => Promise<boolean>;
  UPDATE_WORKOUT_PLAN?: (data: any) => Promise<boolean>;
  ADD_RECENT_FOOD?: (data: any) => Promise<boolean>;
}): Promise<{ success: number; failed: number }> => {
  const queue = await getSyncQueue();
  let success = 0;
  let failed = 0;

  console.log(` [SyncQueue] Processing ${queue.length} pending actions...`);

  for (const action of queue) {
    const handler = handlers[action.type];
    if (handler) {
      try {
        const result = await handler(action.data);
        if (result) {
          await removeFromSyncQueue(action.id);
          success++;
          console.log(` [SyncQueue] Synced: ${action.type}`);
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        console.error(` [SyncQueue] Error syncing ${action.type}:`, error);
      }
    }
  }

  return { success, failed };
};

// ==================== OFFLINE WORKOUTS ====================
export const saveOfflineWorkout = async (workout: any): Promise<void> => {
  try {
    const workouts = await getOfflineWorkouts();
    const offlineWorkout = {
      ...workout,
      id: `offline_${Date.now()}`,
      isOffline: true,
      savedAt: Date.now(),
    };
    workouts.push(offlineWorkout);
    await AsyncStorage.setItem(OFFLINE_WORKOUTS_KEY, JSON.stringify(workouts));
    console.log(" [Offline] Workout saved locally");
  } catch (error) {
    console.error("[Offline] Error saving workout:", error);
  }
};

export const getOfflineWorkouts = async (): Promise<any[]> => {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_WORKOUTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("[Offline] Error getting workouts:", error);
    return [];
  }
};

export const clearOfflineWorkouts = async (): Promise<void> => {
  await AsyncStorage.removeItem(OFFLINE_WORKOUTS_KEY);
};

export const removeOfflineWorkout = async (workoutId: string): Promise<void> => {
  try {
    const workouts = await getOfflineWorkouts();
    const filtered = workouts.filter((w) => w.id !== workoutId);
    await AsyncStorage.setItem(OFFLINE_WORKOUTS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("[Offline] Error removing workout:", error);
  }
};

// ==================== OFFLINE RECENT FOODS ====================
export const saveOfflineRecentFood = async (
  userID: string,
  mealName: string,
  food: any
): Promise<void> => {
  try {
    const foods = await getOfflineRecentFoods();
    foods.push({
      userID,
      mealName,
      food,
      timestamp: Date.now(),
      isOffline: true,
    });
    // Keep only the last 50
    const trimmed = foods.slice(-50);
    await AsyncStorage.setItem(OFFLINE_FOODS_KEY, JSON.stringify(trimmed));
    console.log(" [Offline] Recent food saved locally");
  } catch (error) {
    console.error("[Offline] Error saving recent food:", error);
  }
};

export const getOfflineRecentFoods = async (): Promise<any[]> => {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_FOODS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("[Offline] Error getting recent foods:", error);
    return [];
  }
};

export const getOfflineRecentFoodsByMeal = async (
  userID: string,
  mealName: string
): Promise<any[]> => {
  try {
    const foods = await getOfflineRecentFoods();
    return foods
      .filter((f) => f.userID === userID && f.mealName === mealName)
      .map((f) => f.food)
      .reverse()
      .slice(0, 10);
  } catch (error) {
    console.error("[Offline] Error getting recent foods by meal:", error);
    return [];
  }
};

export const clearOfflineRecentFoods = async (): Promise<void> => {
  await AsyncStorage.removeItem(OFFLINE_FOODS_KEY);
};

// ==================== PENDING COUNT ====================
export const getPendingActionsCount = async (): Promise<number> => {
  const queue = await getSyncQueue();
  const offlineWorkouts = await getOfflineWorkouts();
  return queue.length + offlineWorkouts.length;
};