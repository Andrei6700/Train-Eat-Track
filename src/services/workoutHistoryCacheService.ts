import AsyncStorage from "@react-native-async-storage/async-storage";
import { WorkoutHistory } from "@/src/types/index";

const WORKOUT_HISTORY_CACHE_PREFIX = "cached_workout_history_v1_";
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type SerializedWorkoutHistory = Omit<WorkoutHistory, "date"> & {
  date: string;
};

type WorkoutHistoryCachePayload = {
  userID: string;
  updatedAt: number;
  workouts: SerializedWorkoutHistory[];
};

export type CachedWorkoutHistoryResult = {
  data: WorkoutHistory[] | null;
  isFresh: boolean;
  updatedAt: number | null;
  ageMs: number | null;
};

const getCacheKey = (userID: string): string =>
  `${WORKOUT_HISTORY_CACHE_PREFIX}${userID}`;

const toDate = (value: Date | string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
};

const toDateKey = (value: Date | string): string => {
  const date = toDate(value);
  date.setHours(0, 0, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

const serializeWorkout = (workout: WorkoutHistory): SerializedWorkoutHistory => ({
  ...workout,
  date: toDate(workout.date).toISOString(),
});

const deserializeWorkout = (workout: SerializedWorkoutHistory): WorkoutHistory => ({
  ...workout,
  date: toDate(workout.date),
});

const sortWorkoutsDesc = (workouts: WorkoutHistory[]): WorkoutHistory[] =>
  [...workouts].sort(
    (left, right) =>
      toDate(right.date).getTime() - toDate(left.date).getTime(),
  );

const mergeByIdentity = (
  existingWorkouts: WorkoutHistory[],
  nextWorkout: WorkoutHistory,
): WorkoutHistory[] => {
  const nextId = nextWorkout.id;
  const nextDateKey = toDateKey(nextWorkout.date);

  const index = existingWorkouts.findIndex((item) => {
    if (nextId && item.id) {
      return item.id === nextId;
    }
    return toDateKey(item.date) === nextDateKey;
  });

  if (index === -1) {
    return sortWorkoutsDesc([nextWorkout, ...existingWorkouts]);
  }

  const updated = [...existingWorkouts];
  updated[index] = {
    ...updated[index],
    ...nextWorkout,
    date: toDate(nextWorkout.date),
  };
  return sortWorkoutsDesc(updated);
};

const readPayload = async (userID: string): Promise<WorkoutHistoryCachePayload | null> => {
  try {
    const raw = await AsyncStorage.getItem(getCacheKey(userID));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as WorkoutHistoryCachePayload;
    if (!parsed || parsed.userID !== userID || !Array.isArray(parsed.workouts)) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("[WorkoutHistoryCache] Error reading cache:", error);
    return null;
  }
};

const writePayload = async (
  userID: string,
  workouts: WorkoutHistory[],
): Promise<void> => {
  const sorted = sortWorkoutsDesc(workouts);
  const payload: WorkoutHistoryCachePayload = {
    userID,
    updatedAt: Date.now(),
    workouts: sorted.map(serializeWorkout),
  };

  await AsyncStorage.setItem(getCacheKey(userID), JSON.stringify(payload));
};

export const getCachedWorkoutHistory = async (
  userID: string,
  options?: { allowStale?: boolean; ttlMs?: number },
): Promise<CachedWorkoutHistoryResult> => {
  const payload = await readPayload(userID);
  if (!payload) {
    return {
      data: null,
      isFresh: false,
      updatedAt: null,
      ageMs: null,
    };
  }

  const ttlMs = options?.ttlMs ?? DEFAULT_CACHE_TTL_MS;
  const ageMs = Date.now() - payload.updatedAt;
  const isFresh = ageMs < ttlMs;

  if (!isFresh && !options?.allowStale) {
    return {
      data: null,
      isFresh: false,
      updatedAt: payload.updatedAt,
      ageMs,
    };
  }

  return {
    data: payload.workouts.map(deserializeWorkout),
    isFresh,
    updatedAt: payload.updatedAt,
    ageMs,
  };
};

export const setCachedWorkoutHistory = async (
  userID: string,
  workouts: WorkoutHistory[],
): Promise<void> => {
  try {
    await writePayload(userID, workouts);
  } catch (error) {
    console.error("[WorkoutHistoryCache] Error writing cache:", error);
  }
};

export const upsertCachedWorkoutHistoryItem = async (
  userID: string,
  workout: WorkoutHistory,
): Promise<void> => {
  try {
    const existing = await getCachedWorkoutHistory(userID, { allowStale: true });
    const base = existing.data || [];
    const merged = mergeByIdentity(base, {
      ...workout,
      date: toDate(workout.date),
    });

    await writePayload(userID, merged);
  } catch (error) {
    console.error("[WorkoutHistoryCache] Error upserting workout:", error);
  }
};

export const removeCachedWorkoutHistoryItem = async (
  userID: string,
  workoutId: string,
): Promise<void> => {
  try {
    const existing = await getCachedWorkoutHistory(userID, { allowStale: true });
    if (!existing.data) return;

    const filtered = existing.data.filter((item) => item.id !== workoutId);
    await writePayload(userID, filtered);
  } catch (error) {
    console.error("[WorkoutHistoryCache] Error removing workout:", error);
  }
};

export const clearWorkoutHistoryCache = async (userID?: string): Promise<void> => {
  try {
    if (userID) {
      await AsyncStorage.removeItem(getCacheKey(userID));
      return;
    }

    const allKeys = await AsyncStorage.getAllKeys();
    const workoutHistoryKeys = allKeys.filter((key) =>
      key.startsWith(WORKOUT_HISTORY_CACHE_PREFIX),
    );
    if (workoutHistoryKeys.length > 0) {
      await AsyncStorage.multiRemove(workoutHistoryKeys);
    }
  } catch (error) {
    console.error("[WorkoutHistoryCache] Error clearing cache:", error);
  }
};

