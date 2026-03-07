import { addRecentFoodRemote } from "@/src/services/recentFoodsService";
import {
  getDateKey,
  getDailyNutrition,
  saveDailyNutrition,
} from "@/src/services/nutritionService";
import {
  getDailyWater,
  saveDailyWater,
} from "@/src/services/waterService";
import {
  addWorkoutRemote,
} from "@/src/services/workoutService";
import {
  getUserWorkoutPlan,
  upsertWorkoutPlanRemote,
} from "@/src/services/workoutPlanService";
import { DailyNutrition, DailyWater, WorkoutHistory, WorkoutPlan } from "@/src/types/index";
import {
  SyncAction,
  SyncActionHandlersV2,
} from "./syncQueueService";

const DEFAULT_NUTRITION_GOALS = {
  calorieGoal: 2500,
  proteinGoal: 150,
  carbsGoal: 250,
  fatGoal: 70,
};

const DEFAULT_MEALS = [
  { mealName: "Mic Dejun", foods: [] },
  { mealName: "Pranz", foods: [] },
  { mealName: "Cina", foods: [] },
  { mealName: "Gustari", foods: [] },
];

const OMIT_COMPARE_KEYS = new Set([
  "id",
  "updatedAt",
  "createdAt",
  "localUpdatedAt",
  "dateKey",
  "syncStatus",
  "queuedActionId",
  "savedAt",
  "isOffline",
]);

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const toDateFn = (value as { toDate?: () => Date }).toDate;
    if (typeof toDateFn === "function") {
      const parsed = toDateFn();
      if (parsed instanceof Date) return parsed;
    }
  }

  const parsed = new Date(value as any);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
};

const toMillis = (value: unknown): number | null => {
  if (!value) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const toDateFn = (value as { toDate?: () => Date }).toDate;
    if (typeof toDateFn === "function") {
      const parsed = toDateFn();
      return parsed instanceof Date ? parsed.getTime() : null;
    }
  }

  return null;
};

const normalizeForCompare = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForCompare(entry));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !OMIT_COMPARE_KEYS.has(key))
      .sort(([left], [right]) => left.localeCompare(right));

    return entries.reduce<Record<string, unknown>>((accumulator, [key, entry]) => {
      accumulator[key] = normalizeForCompare(entry);
      return accumulator;
    }, {});
  }

  return value;
};

const stableStringify = (value: unknown): string => {
  try {
    return JSON.stringify(normalizeForCompare(value));
  } catch {
    return "";
  }
};

const hasMutableConflict = (
  baseUpdatedAt: number | null | undefined,
  remoteUpdatedAt: number | null,
  localSnapshot: unknown,
  remoteSnapshot: unknown,
): boolean => {
  if (!baseUpdatedAt || !remoteUpdatedAt) {
    return false;
  }

  if (remoteUpdatedAt <= baseUpdatedAt) {
    return false;
  }

  return stableStringify(localSnapshot) !== stableStringify(remoteSnapshot);
};

const buildNutritionFallback = (
  userID: string,
  date: Date,
  goals: {
    calorieGoal?: number;
    proteinGoal?: number;
    carbsGoal?: number;
    fatGoal?: number;
  },
): DailyNutrition => ({
  userID,
  date,
  meals: DEFAULT_MEALS,
  calorieGoal: goals.calorieGoal ?? DEFAULT_NUTRITION_GOALS.calorieGoal,
  proteinGoal: goals.proteinGoal ?? DEFAULT_NUTRITION_GOALS.proteinGoal,
  carbsGoal: goals.carbsGoal ?? DEFAULT_NUTRITION_GOALS.carbsGoal,
  fatGoal: goals.fatGoal ?? DEFAULT_NUTRITION_GOALS.fatGoal,
});

const asNutritionSnapshot = (action: SyncAction): DailyNutrition | null => {
  const payload = (action.data as { nutrition?: DailyNutrition })?.nutrition ?? action.data;
  if (!payload || typeof payload !== "object") return null;

  const nutrition = payload as DailyNutrition;
  if (!nutrition.userID || !nutrition.date) return null;

  return {
    ...nutrition,
    date: toDate(nutrition.date),
  };
};

const asWaterSnapshot = (action: SyncAction): DailyWater | null => {
  const payload = (action.data as { water?: DailyWater })?.water ?? action.data;
  if (!payload || typeof payload !== "object") return null;

  const water = payload as DailyWater;
  if (!water.userID || !water.date) return null;

  return {
    ...water,
    date: toDate(water.date),
    intakes: Array.isArray(water.intakes)
      ? water.intakes.map((intake) => ({
          ...intake,
          timestamp: toDate(intake.timestamp),
        }))
      : [],
  };
};

const asWorkoutPlanSnapshot = (action: SyncAction): WorkoutPlan | null => {
  const payload = (action.data as { plan?: WorkoutPlan })?.plan ?? action.data;
  if (!payload || typeof payload !== "object") return null;

  const plan = payload as WorkoutPlan;
  if (!plan.userID) return null;

  return {
    ...plan,
    createdAt: plan.createdAt ? toDate(plan.createdAt) : new Date(),
    updatedAt: plan.updatedAt ? toDate(plan.updatedAt) : new Date(),
    days: Array.isArray(plan.days) ? plan.days : [],
  };
};

export const buildSyncHandlers = (): SyncActionHandlersV2 => ({
  ADD_WORKOUT: async (action) => {
    const workout = action.data as WorkoutHistory;
    if (!workout?.userID || !workout?.date) {
      return { status: "failed", error: "Invalid workout payload" };
    }

    const result = await addWorkoutRemote(
      {
        ...workout,
        date: toDate(workout.date),
      },
      { forceOverwrite: Boolean(action.forceOverwriteOnce) },
    );

    if (result.success) {
      return { status: "success" };
    }

    if (result.code === "SYNC_CONFLICT") {
      return {
        status: "conflict",
        error: result.msg || "Workout sync conflict",
        localSnapshot: result.data?.localSnapshot ?? workout,
        remoteSnapshot: result.data?.remoteSnapshot,
      };
    }

    return { status: "retry", error: result.msg || "Workout sync failed" };
  },

  ADD_RECENT_FOOD: async (action) => {
    const payload = action.data as {
      userID?: string;
      mealName?: string;
      food?: any;
    };

    if (!payload?.userID || !payload?.mealName || !payload?.food) {
      return { status: "failed", error: "Invalid recent food payload" };
    }

    const result = await addRecentFoodRemote(
      payload.userID,
      payload.mealName,
      payload.food,
    );

    if (result.success) {
      return { status: "success" };
    }

    return { status: "retry", error: result.msg || "Recent food sync failed" };
  },

  UPSERT_NUTRITION: async (action) => {
    const nutrition = asNutritionSnapshot(action);
    if (!nutrition) {
      return { status: "failed", error: "Invalid nutrition payload" };
    }

    const remoteResult = await getDailyNutrition(nutrition.userID, toDate(nutrition.date));
    if (!remoteResult.success) {
      return { status: "retry", error: remoteResult.msg || "Cannot fetch remote nutrition" };
    }

    const remoteNutrition = remoteResult.data as DailyNutrition | null;
    const remoteUpdatedAt = remoteNutrition ? toMillis(remoteNutrition.updatedAt) : null;

    const conflict =
      remoteNutrition &&
      !action.forceOverwriteOnce &&
      hasMutableConflict(action.baseUpdatedAt, remoteUpdatedAt, nutrition, remoteNutrition);

    if (conflict) {
      return {
        status: "conflict",
        error: "Nutrition was changed remotely after your local edit.",
        localSnapshot: nutrition,
        remoteSnapshot: remoteNutrition,
      };
    }

    const savePayload: DailyNutrition = {
      ...nutrition,
      id: remoteNutrition?.id || nutrition.id,
      date: toDate(nutrition.date),
    };

    const saveResult = await saveDailyNutrition(savePayload);
    if (!saveResult.success) {
      return { status: "retry", error: saveResult.msg || "Nutrition sync failed" };
    }

    return { status: "success" };
  },

  UPSERT_WATER: async (action) => {
    const water = asWaterSnapshot(action);
    if (!water) {
      return { status: "failed", error: "Invalid water payload" };
    }

    const remoteResult = await getDailyWater(water.userID, toDate(water.date));
    if (!remoteResult.success) {
      return { status: "retry", error: remoteResult.msg || "Cannot fetch remote water" };
    }

    const remoteWater = remoteResult.data as DailyWater | null;
    const remoteUpdatedAt = remoteWater ? toMillis(remoteWater.updatedAt) : null;

    const conflict =
      remoteWater &&
      !action.forceOverwriteOnce &&
      hasMutableConflict(action.baseUpdatedAt, remoteUpdatedAt, water, remoteWater);

    if (conflict) {
      return {
        status: "conflict",
        error: "Water tracking was changed remotely after your local edit.",
        localSnapshot: water,
        remoteSnapshot: remoteWater,
      };
    }

    const savePayload: DailyWater = {
      ...water,
      id: remoteWater?.id || water.id,
      date: toDate(water.date),
    };

    const saveResult = await saveDailyWater(savePayload);
    if (!saveResult.success) {
      return { status: "retry", error: saveResult.msg || "Water sync failed" };
    }

    return { status: "success" };
  },

  UPSERT_GOALS: async (action) => {
    const payload = action.data as {
      userID?: string;
      date?: string | Date;
      dateKey?: string;
      goals?: {
        calorieGoal?: number;
        proteinGoal?: number;
        carbsGoal?: number;
        fatGoal?: number;
      };
    };

    if (!payload?.userID || !payload?.date) {
      return { status: "failed", error: "Invalid goals payload" };
    }

    const targetDate = toDate(payload.date);
    const dateKey = payload.dateKey || getDateKey(targetDate);

    const remoteResult = await getDailyNutrition(payload.userID, targetDate);
    if (!remoteResult.success) {
      return { status: "retry", error: remoteResult.msg || "Cannot fetch remote goals" };
    }

    const remoteNutrition = remoteResult.data as DailyNutrition | null;
    const remoteUpdatedAt = remoteNutrition ? toMillis(remoteNutrition.updatedAt) : null;

    const goals = payload.goals || {};
    const remoteGoals = remoteNutrition
      ? {
          calorieGoal: remoteNutrition.calorieGoal,
          proteinGoal: remoteNutrition.proteinGoal,
          carbsGoal: remoteNutrition.carbsGoal,
          fatGoal: remoteNutrition.fatGoal,
        }
      : null;

    const conflict =
      remoteGoals &&
      !action.forceOverwriteOnce &&
      hasMutableConflict(action.baseUpdatedAt, remoteUpdatedAt, goals, remoteGoals);

    if (conflict) {
      return {
        status: "conflict",
        error: "Goals were changed remotely after your local edit.",
        localSnapshot: { dateKey, goals },
        remoteSnapshot: { dateKey, goals: remoteGoals },
      };
    }

    const nextNutrition = remoteNutrition
      ? {
          ...remoteNutrition,
          ...goals,
          date: targetDate,
        }
      : buildNutritionFallback(payload.userID, targetDate, goals);

    const saveResult = await saveDailyNutrition(nextNutrition);
    if (!saveResult.success) {
      return { status: "retry", error: saveResult.msg || "Goals sync failed" };
    }

    return { status: "success" };
  },

  UPSERT_WORKOUT_PLAN: async (action) => {
    const plan = asWorkoutPlanSnapshot(action);
    if (!plan) {
      return { status: "failed", error: "Invalid workout plan payload" };
    }

    const remoteResult = await getUserWorkoutPlan(plan.userID);
    if (!remoteResult.success) {
      return { status: "retry", error: remoteResult.msg || "Cannot fetch remote workout plan" };
    }

    const remotePlan = remoteResult.data as WorkoutPlan | null;
    const remoteUpdatedAt = remotePlan ? toMillis(remotePlan.updatedAt) : null;

    const conflict =
      remotePlan &&
      !action.forceOverwriteOnce &&
      hasMutableConflict(action.baseUpdatedAt, remoteUpdatedAt, plan, remotePlan);

    if (conflict) {
      return {
        status: "conflict",
        error: "Workout plan was changed remotely after your local edit.",
        localSnapshot: plan,
        remoteSnapshot: remotePlan,
      };
    }

    const savePayload: WorkoutPlan = {
      ...plan,
      id: remotePlan?.id || plan.id,
      createdAt: remotePlan?.createdAt || plan.createdAt,
      updatedAt: new Date(),
    };

    const saveResult = await upsertWorkoutPlanRemote(savePayload);
    if (!saveResult.success) {
      return { status: "retry", error: saveResult.msg || "Workout plan sync failed" };
    }

    return { status: "success" };
  },

  UPDATE_NUTRITION: async (action) => {
    const nutritionAction: SyncAction = {
      ...action,
      type: "UPSERT_NUTRITION",
    };
    return buildSyncHandlers().UPSERT_NUTRITION?.(nutritionAction) ?? {
      status: "failed",
      error: "Missing nutrition handler",
    };
  },

  ADD_WATER: async (action) => {
    const waterAction: SyncAction = {
      ...action,
      type: "UPSERT_WATER",
    };
    return buildSyncHandlers().UPSERT_WATER?.(waterAction) ?? {
      status: "failed",
      error: "Missing water handler",
    };
  },

  UPDATE_WORKOUT_PLAN: async (action) => {
    const planAction: SyncAction = {
      ...action,
      type: "UPSERT_WORKOUT_PLAN",
    };
    return buildSyncHandlers().UPSERT_WORKOUT_PLAN?.(planAction) ?? {
      status: "failed",
      error: "Missing workout plan handler",
    };
  },
});
