import { useAuth } from "@/src/contexts/authContext";
import {
  cacheWorkoutPlan,
  clearExpiredCache,
  getCachedWorkoutPlan
} from "@/src/services/cacheService";
import {
  deleteWorkoutPlan,
  getUserWorkoutPlan,
  updateWorkoutPlan
} from "@/src/services/workoutPlanService";
import { DayWorkout, WorkoutPlan } from "@/src/types/index";
import React, { createContext, useContext, useEffect, useState } from "react";

type WorkoutPlanContextType = {
  workoutPlan: WorkoutPlan | null;
  loading: boolean;
  updateDay: (day: string, dayData: DayWorkout) => Promise<void>;
  setPlanDraft: (plan: WorkoutPlan | null) => void;
  clearPlanDraft: () => void;
  refreshPlan: () => Promise<void>;
  deletePlan: () => Promise<{ success: boolean; msg?: string }>;
};

const WorkoutPlanContext = createContext<WorkoutPlanContextType | null>(null);

const parseDayNumber = (dayValue: string): number | null => {
  const match = dayValue.match(/^Day\s+(\d+)$/i);
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const normalizeSplitDays = (splitDays: unknown): number => {
  const parsed = Number(splitDays);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
};

const ensureCycleDays = (days: DayWorkout[] | undefined, splitDays: number): DayWorkout[] => {
  const sourceDays = Array.isArray(days) ? days : [];

  return Array.from({ length: splitDays }, (_, idx) => {
    const dayLabel = `Day ${idx + 1}`;
    const existingDay = sourceDays.find((entry) => entry.day === dayLabel);
    if (existingDay) return existingDay;

    return {
      day: dayLabel,
      isRestDay: false,
      exercises: [],
    };
  });
};

const createBaseLocalPlan = (userID: string, minSplitDays = 1): WorkoutPlan => {
  const now = new Date();
  const splitDays = Math.max(1, Math.floor(minSplitDays));
  return {
    userID,
    planName: "",
    splitDays,
    days: ensureCycleDays([], splitDays),
    createdAt: now,
    updatedAt: now,
  };
};

const buildPlanWithUpdatedDay = (
  basePlan: WorkoutPlan,
  targetDayLabel: string,
  targetDayNumber: number,
  dayData: DayWorkout,
): WorkoutPlan => {
  const nextSplitDays = Math.max(
    normalizeSplitDays(basePlan.splitDays),
    targetDayNumber,
  );
  const normalizedDays = ensureCycleDays(basePlan.days, nextSplitDays);

  const normalizedDayData: DayWorkout = {
    ...dayData,
    day: targetDayLabel,
  };

  const updatedDays = normalizedDays.map((entry) =>
    entry.day === targetDayLabel ? normalizedDayData : entry,
  );

  return {
    ...basePlan,
    splitDays: nextSplitDays,
    days: updatedDays,
    updatedAt: new Date(),
  };
};

export const WorkoutPlanProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [planDraft, setPlanDraftState] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const activePlan = planDraft ?? workoutPlan;

  useEffect(() => {
    if (user?.uid) {
      loadWorkoutPlan();
      clearExpiredCache(); // Cleans expired cache on startup
    } else {
      setPlanDraftState(null);
      setWorkoutPlan(null);
      setLoading(false);
    }
  }, [user?.uid]);

  const loadWorkoutPlan = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    if (__DEV__) {
      console.log("[WorkoutPlanContext] Loading workout plan for user:", user.uid);
    }

    //  Try to load from cache
    const cachedPlan = await getCachedWorkoutPlan();
    if (cachedPlan) {
      if (__DEV__) {
        console.log(" [WorkoutPlanContext] Using cached workout plan");
      }
      setWorkoutPlan(cachedPlan);
      setLoading(false);
      
      // Synchronize in background
      syncPlanInBackground();
      return;
    }

    //  Load from Firebase
    const result = await getUserWorkoutPlan(user.uid);
    if (result.success && result.data) {
      if (__DEV__) {
        console.log("[WorkoutPlanContext] Plan loaded from Firebase:", result.data.id);
      }
      setWorkoutPlan(result.data);
      
      // Save to cache
      await cacheWorkoutPlan(result.data);
    } else {
      if (__DEV__) {
        console.log("[WorkoutPlanContext] No plan found for user");
      }
      setWorkoutPlan(null);
    }
    
    setLoading(false);
  };

  /**
   * Synchronize the plan in background without loading
   */
  const syncPlanInBackground = async () => {
    if (!user?.uid) return;

    try {
      const result = await getUserWorkoutPlan(user.uid);
      if (result.success && result.data) {
        setWorkoutPlan(result.data);
        await cacheWorkoutPlan(result.data);
        if (__DEV__) {
          console.log(" [WorkoutPlanContext] Background sync completed");
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error("[WorkoutPlanContext] Background sync failed:", error);
      }
    }
  };

  const updateDay = async (day: string, dayData: DayWorkout) => {
    if (!user?.uid) {
      if (__DEV__) {
        console.log("[WorkoutPlanContext] updateDay aborted, no user");
      }
      return;
    }
    const userId = user.uid;

    if (__DEV__) {
      console.log("[WorkoutPlanContext] updateDay", day, dayData);
    }

    const dayNumber = parseDayNumber(day) ?? 1;
    const dayLabel = `Day ${dayNumber}`;
    const shouldUseDraft = Boolean(planDraft) || !workoutPlan?.id;

    if (shouldUseDraft) {
      setPlanDraftState((currentDraft) => {
        const basePlan =
          currentDraft ??
          workoutPlan ??
          createBaseLocalPlan(userId, dayNumber);

        const updatedDraft = buildPlanWithUpdatedDay(
          basePlan,
          dayLabel,
          dayNumber,
          dayData,
        );

        if (__DEV__) {
          console.log("[WorkoutPlanContext] Updated local draft plan");
        }
        return updatedDraft;
      });
      return;
    }

    const fallbackPlan = workoutPlan;
    if (!fallbackPlan) return;
    const updatedPlan = buildPlanWithUpdatedDay(
      fallbackPlan,
      dayLabel,
      dayNumber,
      dayData,
    );

    setWorkoutPlan((currentPlan) =>
      buildPlanWithUpdatedDay(
        currentPlan ?? fallbackPlan,
        dayLabel,
        dayNumber,
        dayData,
      ),
    );

    await cacheWorkoutPlan(updatedPlan);

    if (updatedPlan.id) {
      try {
        if (__DEV__) {
          console.log(
            "[WorkoutPlanContext] Updating plan in Firebase:",
            updatedPlan.id,
          );
        }
        await updateWorkoutPlan(updatedPlan.id, updatedPlan);
      } catch (err) {
        if (__DEV__) {
          console.error("[WorkoutPlanContext] Error updating plan on backend:", err);
        }
      }
    }
  };

  const setPlanDraft = (plan: WorkoutPlan | null) => {
    if (!plan) {
      setPlanDraftState(null);
      return;
    }

    const splitFromPlan = normalizeSplitDays(plan.splitDays);
    const maxDayFromPayload = (plan.days || []).reduce((max, entry) => {
      const dayNumber = parseDayNumber(entry.day) ?? 0;
      return Math.max(max, dayNumber);
    }, 0);
    const splitDays = Math.max(splitFromPlan, maxDayFromPayload || 1);

    setPlanDraftState({
      ...plan,
      splitDays,
      days: ensureCycleDays(plan.days, splitDays),
      createdAt: plan.createdAt || new Date(),
      updatedAt: new Date(),
    });
  };

  const clearPlanDraft = () => {
    setPlanDraftState(null);
  };

  const refreshPlan = async () => {
    await loadWorkoutPlan();
  };

  const deletePlan = async (): Promise<{ success: boolean; msg?: string }> => {
    if (!workoutPlan?.id || !user?.uid) {
      return { success: false, msg: "No workout plan to delete" };
    }

    try {
      const result = await deleteWorkoutPlan(workoutPlan.id, user.uid);
      if (result.success) {
        setPlanDraftState(null);
        setWorkoutPlan(null);
        
        // Delete from cache
        await cacheWorkoutPlan(null as any);
        
        return { success: true, msg: result.msg || "Workout plan deleted successfully" };
      }
      return result;
    } catch (error: any) {
      if (__DEV__) {
        console.error("[WorkoutPlanContext] Error deleting plan:", error);
      }
      return { success: false, msg: error?.message || "Could not delete workout plan" };
    }
  };

  return (
    <WorkoutPlanContext.Provider
      value={{
        workoutPlan: activePlan,
        loading,
        updateDay,
        setPlanDraft,
        clearPlanDraft,
        refreshPlan,
        deletePlan,
      }}
    >
      {children}
    </WorkoutPlanContext.Provider>
  );
};

export const useWorkoutPlan = (): WorkoutPlanContextType => {
  const context = useContext(WorkoutPlanContext);
  if (!context) {
    throw new Error("useWorkoutPlan must be used within a WorkoutPlanProvider");
  }
  return context;
};
