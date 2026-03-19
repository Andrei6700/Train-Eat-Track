import AsyncStorage from "@react-native-async-storage/async-storage";

const SYNC_QUEUE_KEY = "offline_sync_queue_v2";
const LEGACY_SYNC_QUEUE_KEY = "offline_sync_queue";
const LEGACY_OFFLINE_WORKOUTS_KEY = "offline_workouts";
const OFFLINE_FOODS_KEY = "offline_foods";

const DEFAULT_MAX_ATTEMPTS = 6;
const BASE_RETRY_DELAY_MS = 1_500;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1_000;
const RETRY_JITTER_FACTOR = 0.2;

type QueueMergeStrategy = "append" | "replace_latest";

export type SyncActionType =
  | "ADD_WORKOUT"
  | "ADD_RECENT_FOOD"
  | "UPSERT_NUTRITION"
  | "UPSERT_WATER"
  | "UPSERT_GOALS"
  | "UPSERT_WORKOUT_PLAN"
  | "ADD_FOOD"
  | "ADD_WATER"
  | "UPDATE_WORKOUT_PLAN"
  | "UPDATE_NUTRITION";

export type SyncActionStatus =
  | "pending"
  | "processing"
  | "retry_scheduled"
  | "failed"
  | "conflict";

export type ConflictResolution = "KEEP_SERVER" | "KEEP_LOCAL";

export type SyncConflictDetails = {
  detectedAt: number;
  reason?: string;
  localSnapshot?: unknown;
  remoteSnapshot?: unknown;
};

export type SyncAction<T = any> = {
  id: string;
  type: SyncActionType;
  data: T;
  status: SyncActionStatus;
  timestamp: number;
  attempt: number;
  maxAttempts: number;
  nextRetryAt: number | null;
  lastError?: string;
  dedupeKey?: string;
  baseUpdatedAt?: number | null;
  forceOverwriteOnce?: boolean;
  conflict?: SyncConflictDetails;
};

export type SyncHandlerResult =
  | { status: "success" }
  | { status: "retry"; error?: string }
  | {
      status: "conflict";
      error?: string;
      localSnapshot?: unknown;
      remoteSnapshot?: unknown;
    }
  | { status: "failed"; error?: string };

export type SyncActionHandlersV2 = {
  [K in SyncActionType]?: (action: SyncAction) => Promise<SyncHandlerResult>;
};

export type SyncQueueSummary = {
  total: number;
  pending: number;
  processing: number;
  retryScheduled: number;
  failed: number;
  conflicts: number;
  nextRetryAt: number | null;
};

export type SyncProcessResult = {
  processed: number;
  success: number;
  retryScheduled: number;
  failed: number;
  conflicts: number;
  skipped: number;
};

type EnqueueActionInput = {
  type: SyncActionType;
  data: any;
  dedupeKey?: string;
  baseUpdatedAt?: number | Date | null;
  mergeStrategy?: QueueMergeStrategy;
  maxAttempts?: number;
};

type LegacySyncAction = {
  id: string;
  type: SyncActionType;
  data: any;
  timestamp: number;
  retryCount?: number;
};

type SyncQueueListener = (summary: SyncQueueSummary) => void;

const listeners = new Set<SyncQueueListener>();
let processingPromise: Promise<SyncProcessResult> | null = null;

const normalizeTimestamp = (value: number | Date | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  return Number.isFinite(value) ? value : null;
};

const randomId = (): string =>
  `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const toSerializableError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown sync error";
  }
};

const isSyncActionStatus = (value: unknown): value is SyncActionStatus =>
  value === "pending" ||
  value === "processing" ||
  value === "retry_scheduled" ||
  value === "failed" ||
  value === "conflict";

const toDate = (value: Date | string | number | undefined): Date => {
  const date = value instanceof Date ? new Date(value) : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  return date;
};

export const toDateKey = (value: Date | string | number): string => {
  const date = toDate(value);
  date.setHours(0, 0, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

const getDefaultDedupeKey = (type: SyncActionType, data: any): string | undefined => {
  switch (type) {
    case "ADD_WORKOUT": {
      const userID = data?.userID ?? "unknown";
      return `${userID}:${toDateKey(data?.date ?? Date.now())}`;
    }
    case "UPSERT_NUTRITION": {
      const nutrition = data?.nutrition ?? data;
      const userID = nutrition?.userID ?? data?.userID ?? "unknown";
      const dateKey = data?.dateKey ?? toDateKey(nutrition?.date ?? Date.now());
      return `${userID}:${dateKey}`;
    }
    case "UPSERT_WATER": {
      const water = data?.water ?? data;
      const userID = water?.userID ?? data?.userID ?? "unknown";
      const dateKey = data?.dateKey ?? toDateKey(water?.date ?? Date.now());
      return `${userID}:${dateKey}`;
    }
    case "UPSERT_GOALS": {
      const userID = data?.userID ?? "unknown";
      const dateKey = data?.dateKey ?? toDateKey(data?.date ?? Date.now());
      return `${userID}:${dateKey}`;
    }
    case "UPSERT_WORKOUT_PLAN": {
      const plan = data?.plan ?? data;
      const userID = plan?.userID ?? data?.userID ?? "unknown";
      return `${userID}:workout_plan`;
    }
    default:
      return undefined;
  }
};

const isMergeableStatus = (status: SyncActionStatus): boolean =>
  status === "pending" || status === "processing" || status === "retry_scheduled" || status === "failed";

const getRetryDelayMs = (attemptNumber: number): number => {
  const exponentialDelay = Math.min(
    BASE_RETRY_DELAY_MS * Math.pow(2, Math.max(0, attemptNumber - 1)),
    MAX_RETRY_DELAY_MS,
  );
  const jitterRange = exponentialDelay * RETRY_JITTER_FACTOR;
  const jitter = (Math.random() * jitterRange * 2) - jitterRange;
  return Math.max(1_000, Math.round(exponentialDelay + jitter));
};

const emitQueueSummary = async (): Promise<void> => {
  if (listeners.size === 0) return;
  const summary = await getSyncSummary();
  listeners.forEach((listener) => {
    try {
      listener(summary);
    } catch (error) {
      if (__DEV__) {
        console.error("[SyncQueueV2] Listener error:", error);
      }
    }
  });
};

const sanitizeQueue = (queue: unknown): SyncAction[] => {
  if (!Array.isArray(queue)) return [];

  return queue
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const action = item as Partial<SyncAction>;
      return {
        id: action.id || randomId(),
        type: (action.type as SyncActionType) || "ADD_WORKOUT",
        data: action.data,
        status: isSyncActionStatus(action.status) ? action.status : "pending",
        timestamp:
          typeof action.timestamp === "number" && Number.isFinite(action.timestamp)
            ? action.timestamp
            : Date.now(),
        attempt:
          typeof action.attempt === "number" && Number.isFinite(action.attempt)
            ? Math.max(0, action.attempt)
            : 0,
        maxAttempts:
          typeof action.maxAttempts === "number" && Number.isFinite(action.maxAttempts)
            ? Math.max(1, action.maxAttempts)
            : DEFAULT_MAX_ATTEMPTS,
        nextRetryAt:
          typeof action.nextRetryAt === "number" && Number.isFinite(action.nextRetryAt)
            ? action.nextRetryAt
            : null,
        lastError: action.lastError,
        dedupeKey: action.dedupeKey,
        baseUpdatedAt:
          typeof action.baseUpdatedAt === "number" && Number.isFinite(action.baseUpdatedAt)
            ? action.baseUpdatedAt
            : null,
        forceOverwriteOnce: Boolean(action.forceOverwriteOnce),
        conflict: action.conflict,
      } as SyncAction;
    });
};

const migrateLegacyQueueIfNeeded = async (): Promise<void> => {
  try {
    const existingV2 = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    if (existingV2) {
      return;
    }

    const migratedQueue: SyncAction[] = [];

    const legacyQueueRaw = await AsyncStorage.getItem(LEGACY_SYNC_QUEUE_KEY);
    if (legacyQueueRaw) {
      const legacyQueue = JSON.parse(legacyQueueRaw) as LegacySyncAction[];
      if (Array.isArray(legacyQueue)) {
        legacyQueue.forEach((legacyAction) => {
          const dedupeKey = getDefaultDedupeKey(legacyAction.type, legacyAction.data);
          migratedQueue.push({
            id: legacyAction.id || randomId(),
            type: legacyAction.type,
            data: legacyAction.data,
            status: "pending",
            timestamp: legacyAction.timestamp || Date.now(),
            attempt: Math.max(0, legacyAction.retryCount ?? 0),
            maxAttempts: DEFAULT_MAX_ATTEMPTS,
            nextRetryAt: null,
            dedupeKey,
            baseUpdatedAt: null,
            forceOverwriteOnce: false,
          });
        });
      }
    }

    const legacyOfflineWorkoutsRaw = await AsyncStorage.getItem(LEGACY_OFFLINE_WORKOUTS_KEY);
    if (legacyOfflineWorkoutsRaw) {
      const offlineWorkouts = JSON.parse(legacyOfflineWorkoutsRaw) as any[];
      if (Array.isArray(offlineWorkouts)) {
        offlineWorkouts.forEach((workout) => {
          migratedQueue.push({
            id: randomId(),
            type: "ADD_WORKOUT",
            data: workout,
            status: "pending",
            timestamp: workout?.savedAt ?? Date.now(),
            attempt: 0,
            maxAttempts: DEFAULT_MAX_ATTEMPTS,
            nextRetryAt: null,
            dedupeKey: getDefaultDedupeKey("ADD_WORKOUT", workout),
            baseUpdatedAt: null,
            forceOverwriteOnce: false,
          });
        });
      }
    }

    if (migratedQueue.length > 0) {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(migratedQueue));
    }

    await AsyncStorage.removeItem(LEGACY_SYNC_QUEUE_KEY);
    await AsyncStorage.removeItem(LEGACY_OFFLINE_WORKOUTS_KEY);
  } catch (error) {
    if (__DEV__) {
      console.error("[SyncQueueV2] Migration error:", error);
    }
  }
};

const readQueue = async (): Promise<SyncAction[]> => {
  try {
    await migrateLegacyQueueIfNeeded();
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    return sanitizeQueue(JSON.parse(raw));
  } catch (error) {
    if (__DEV__) {
      console.error("[SyncQueueV2] Error reading queue:", error);
    }
    return [];
  }
};

const writeQueue = async (queue: SyncAction[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    await emitQueueSummary();
  } catch (error) {
    if (__DEV__) {
      console.error("[SyncQueueV2] Error writing queue:", error);
    }
  }
};

export const subscribeToSyncQueue = (listener: SyncQueueListener): (() => void) => {
  listeners.add(listener);
  void getSyncSummary().then((summary) => {
    listener(summary);
  });

  return () => {
    listeners.delete(listener);
  };
};

export const enqueueOrMergeAction = async (
  input: EnqueueActionInput,
): Promise<SyncAction> => {
  const queue = await readQueue();
  const now = Date.now();
  const dedupeKey = input.dedupeKey ?? getDefaultDedupeKey(input.type, input.data);
  const mergeStrategy = input.mergeStrategy ?? "append";
  const normalizedBaseUpdatedAt = normalizeTimestamp(input.baseUpdatedAt ?? null);

  if (mergeStrategy === "replace_latest" && dedupeKey) {
    const existingIndex = queue.findIndex(
      (action) =>
        action.type === input.type &&
        action.dedupeKey === dedupeKey &&
        isMergeableStatus(action.status),
    );

    if (existingIndex >= 0) {
      const updatedAction: SyncAction = {
        ...queue[existingIndex],
        data: input.data,
        status: "pending",
        timestamp: now,
        attempt: 0,
        nextRetryAt: null,
        lastError: undefined,
        baseUpdatedAt: normalizedBaseUpdatedAt,
        forceOverwriteOnce: false,
        conflict: undefined,
      };
      queue[existingIndex] = updatedAction;
      await writeQueue(queue);
      return updatedAction;
    }
  }

  const newAction: SyncAction = {
    id: randomId(),
    type: input.type,
    data: input.data,
    status: "pending",
    timestamp: now,
    attempt: 0,
    maxAttempts: Math.max(1, input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS),
    nextRetryAt: null,
    dedupeKey,
    baseUpdatedAt: normalizedBaseUpdatedAt,
    forceOverwriteOnce: false,
  };

  queue.push(newAction);
  await writeQueue(queue);
  return newAction;
};

export const getSyncQueue = async (): Promise<SyncAction[]> => {
  const queue = await readQueue();
  return [...queue].sort((a, b) => a.timestamp - b.timestamp);
};

export const removeFromSyncQueue = async (actionId: string): Promise<void> => {
  const queue = await readQueue();
  const filteredQueue = queue.filter((action) => action.id !== actionId);
  await writeQueue(filteredQueue);
};

export const clearSyncQueue = async (): Promise<void> => {
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
  await emitQueueSummary();
};

export const getSyncSummary = async (): Promise<SyncQueueSummary> => {
  const queue = await readQueue();

  let pending = 0;
  let processing = 0;
  let retryScheduled = 0;
  let failed = 0;
  let conflicts = 0;
  let nextRetryAt: number | null = null;

  for (const action of queue) {
    if (action.status === "pending") pending += 1;
    if (action.status === "processing") processing += 1;
    if (action.status === "retry_scheduled") {
      retryScheduled += 1;
      if (typeof action.nextRetryAt === "number") {
        if (nextRetryAt === null || action.nextRetryAt < nextRetryAt) {
          nextRetryAt = action.nextRetryAt;
        }
      }
    }
    if (action.status === "failed") failed += 1;
    if (action.status === "conflict") conflicts += 1;
  }

  return {
    total: queue.length,
    pending,
    processing,
    retryScheduled,
    failed,
    conflicts,
    nextRetryAt,
  };
};

export const getFirstConflictAction = async (): Promise<SyncAction | null> => {
  const queue = await readQueue();
  const conflict = queue
    .filter((action) => action.status === "conflict")
    .sort((a, b) => a.timestamp - b.timestamp)[0];
  return conflict || null;
};

export const resolveConflict = async (
  actionId: string,
  resolution: ConflictResolution,
): Promise<boolean> => {
  const queue = await readQueue();
  const index = queue.findIndex((action) => action.id === actionId);
  if (index < 0) return false;

  const target = queue[index];
  if (target.status !== "conflict") return false;

  if (resolution === "KEEP_SERVER") {
    queue.splice(index, 1);
  } else {
    queue[index] = {
      ...target,
      status: "pending",
      attempt: 0,
      nextRetryAt: null,
      lastError: undefined,
      forceOverwriteOnce: true,
      conflict: undefined,
    };
  }

  await writeQueue(queue);
  return true;
};

export const processSyncQueueV2 = async (
  handlers: SyncActionHandlersV2,
): Promise<SyncProcessResult> => {
  if (processingPromise) {
    return await processingPromise;
  }

  processingPromise = (async (): Promise<SyncProcessResult> => {
    let queue = await readQueue();
    queue = queue.sort((a, b) => a.timestamp - b.timestamp);

    let processed = 0;
    let success = 0;
    let retryScheduled = 0;
    let failed = 0;
    let conflicts = 0;
    let skipped = 0;

    for (let index = 0; index < queue.length; index += 1) {
      const action = queue[index];
      const handler = handlers[action.type];

      if (!handler) {
        skipped += 1;
        continue;
      }

      if (action.status === "conflict" || action.status === "failed") {
        skipped += 1;
        continue;
      }

      if (
        action.status === "retry_scheduled" &&
        typeof action.nextRetryAt === "number" &&
        action.nextRetryAt > Date.now()
      ) {
        skipped += 1;
        continue;
      }

      const processingAction: SyncAction = {
        ...action,
        status: "processing",
        lastError: undefined,
      };
      queue[index] = processingAction;
      await writeQueue(queue);

      let result: SyncHandlerResult;
      try {
        result = await handler(processingAction);
      } catch (error) {
        result = {
          status: "retry",
          error: toSerializableError(error),
        };
      }

      processed += 1;

      if (result.status === "success") {
        queue.splice(index, 1);
        index -= 1;
        success += 1;
        await writeQueue(queue);
        continue;
      }

      if (result.status === "conflict") {
        queue[index] = {
          ...processingAction,
          status: "conflict",
          lastError: result.error,
          conflict: {
            detectedAt: Date.now(),
            reason: result.error,
            localSnapshot: result.localSnapshot,
            remoteSnapshot: result.remoteSnapshot,
          },
        };
        conflicts += 1;
        await writeQueue(queue);
        continue;
      }

      const nextAttempt = processingAction.attempt + 1;

      if (result.status === "failed" || nextAttempt >= processingAction.maxAttempts) {
        queue[index] = {
          ...processingAction,
          status: "failed",
          attempt: nextAttempt,
          nextRetryAt: null,
          lastError: result.error,
        };
        failed += 1;
        await writeQueue(queue);
        continue;
      }

      queue[index] = {
        ...processingAction,
        status: "retry_scheduled",
        attempt: nextAttempt,
        nextRetryAt: Date.now() + getRetryDelayMs(nextAttempt),
        lastError: result.error,
      };
      retryScheduled += 1;
      await writeQueue(queue);
    }

    return {
      processed,
      success,
      retryScheduled,
      failed,
      conflicts,
      skipped,
    };
  })();

  try {
    const result = await processingPromise;
    return result;
  } finally {
    processingPromise = null;
  }
};

// ==================== Compatibility API ====================
export const addToSyncQueue = async (
  action: Omit<SyncAction, "id" | "timestamp" | "status" | "attempt" | "maxAttempts" | "nextRetryAt">,
): Promise<void> => {
  const dedupeKey = action.dedupeKey ?? getDefaultDedupeKey(action.type, action.data);
  const mergeStrategy: QueueMergeStrategy =
    action.type === "ADD_WORKOUT" ||
    action.type === "UPSERT_NUTRITION" ||
    action.type === "UPSERT_WATER" ||
    action.type === "UPSERT_GOALS" ||
    action.type === "UPSERT_WORKOUT_PLAN"
      ? "replace_latest"
      : "append";

  await enqueueOrMergeAction({
    type: action.type,
    data: action.data,
    dedupeKey,
    baseUpdatedAt: action.baseUpdatedAt,
    mergeStrategy,
  });
};

export const processSyncQueue = async (handlers: {
  ADD_WORKOUT?: (data: any) => Promise<boolean>;
  UPDATE_NUTRITION?: (data: any) => Promise<boolean>;
  ADD_FOOD?: (data: any) => Promise<boolean>;
  ADD_WATER?: (data: any) => Promise<boolean>;
  UPDATE_WORKOUT_PLAN?: (data: any) => Promise<boolean>;
  ADD_RECENT_FOOD?: (data: any) => Promise<boolean>;
}): Promise<{ success: number; failed: number }> => {
  const wrappedHandlers: SyncActionHandlersV2 = {
    ADD_WORKOUT: handlers.ADD_WORKOUT
      ? async (action) => {
          const ok = await handlers.ADD_WORKOUT?.(action.data);
          return ok ? { status: "success" } : { status: "retry" };
        }
      : undefined,
    UPDATE_NUTRITION: handlers.UPDATE_NUTRITION
      ? async (action) => {
          const ok = await handlers.UPDATE_NUTRITION?.(action.data);
          return ok ? { status: "success" } : { status: "retry" };
        }
      : undefined,
    ADD_FOOD: handlers.ADD_FOOD
      ? async (action) => {
          const ok = await handlers.ADD_FOOD?.(action.data);
          return ok ? { status: "success" } : { status: "retry" };
        }
      : undefined,
    ADD_WATER: handlers.ADD_WATER
      ? async (action) => {
          const ok = await handlers.ADD_WATER?.(action.data);
          return ok ? { status: "success" } : { status: "retry" };
        }
      : undefined,
    UPDATE_WORKOUT_PLAN: handlers.UPDATE_WORKOUT_PLAN
      ? async (action) => {
          const ok = await handlers.UPDATE_WORKOUT_PLAN?.(action.data);
          return ok ? { status: "success" } : { status: "retry" };
        }
      : undefined,
    ADD_RECENT_FOOD: handlers.ADD_RECENT_FOOD
      ? async (action) => {
          const ok = await handlers.ADD_RECENT_FOOD?.(action.data);
          return ok ? { status: "success" } : { status: "retry" };
        }
      : undefined,
  };

  const result = await processSyncQueueV2(wrappedHandlers);
  return {
    success: result.success,
    failed: result.failed + result.conflicts,
  };
};

const buildLocalWorkoutId = (actionId: string): string => `offline_${actionId}`;

const VISIBLE_WORKOUT_STATUSES = new Set<SyncActionStatus>([
  "pending",
  "processing",
  "retry_scheduled",
  "failed",
  "conflict",
]);

export const getQueuedWorkoutDrafts = async (userID?: string): Promise<any[]> => {
  const queue = await readQueue();
  const workouts = queue
    .filter(
      (action) =>
        action.type === "ADD_WORKOUT" &&
        VISIBLE_WORKOUT_STATUSES.has(action.status) &&
        (!userID || action.data?.userID === userID),
    )
    .map((action) => ({
      ...action.data,
      id: buildLocalWorkoutId(action.id),
      isOffline: true,
      syncStatus: action.status,
      queuedActionId: action.id,
      savedAt: action.timestamp,
    }))
    .sort((a, b) => new Date(b.date || b.savedAt).getTime() - new Date(a.date || a.savedAt).getTime());

  return workouts;
};

// ==================== OFFLINE WORKOUTS (compatibility) ====================
export const saveOfflineWorkout = async (workout: any): Promise<void> => {
  await enqueueOrMergeAction({
    type: "ADD_WORKOUT",
    data: workout,
    dedupeKey: getDefaultDedupeKey("ADD_WORKOUT", workout),
    mergeStrategy: "replace_latest",
  });
};

export const getOfflineWorkouts = async (): Promise<any[]> => {
  return getQueuedWorkoutDrafts();
};

export const clearOfflineWorkouts = async (): Promise<void> => {
  const queue = await readQueue();
  const filtered = queue.filter((action) => action.type !== "ADD_WORKOUT");
  await writeQueue(filtered);
};

export const removeOfflineWorkout = async (workoutId: string): Promise<void> => {
  const actionId = workoutId.startsWith("offline_") ? workoutId.replace("offline_", "") : workoutId;
  await removeFromSyncQueue(actionId);
};

// ==================== OFFLINE RECENT FOODS ====================
export const saveOfflineRecentFood = async (
  userID: string,
  mealName: string,
  food: any,
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
    const trimmed = foods.slice(-50);
    await AsyncStorage.setItem(OFFLINE_FOODS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    if (__DEV__) {
      console.error("[SyncQueueV2] Error saving recent food locally:", error);
    }
  }
};

export const getOfflineRecentFoods = async (): Promise<any[]> => {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_FOODS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    if (__DEV__) {
      console.error("[SyncQueueV2] Error getting local recent foods:", error);
    }
    return [];
  }
};

export const getOfflineRecentFoodsByMeal = async (
  userID: string,
  mealName: string,
): Promise<any[]> => {
  try {
    const foods = await getOfflineRecentFoods();
    return foods
      .filter((entry) => entry.userID === userID && entry.mealName === mealName)
      .map((entry) => entry.food)
      .reverse()
      .slice(0, 10);
  } catch (error) {
    if (__DEV__) {
      console.error("[SyncQueueV2] Error filtering local recent foods:", error);
    }
    return [];
  }
};

export const clearOfflineRecentFoods = async (): Promise<void> => {
  await AsyncStorage.removeItem(OFFLINE_FOODS_KEY);
};

// ==================== Pending count ====================
export const getPendingActionsCount = async (): Promise<number> => {
  const summary = await getSyncSummary();
  return (
    summary.pending +
    summary.processing +
    summary.retryScheduled +
    summary.failed +
    summary.conflicts
  );
};
