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
  refreshPlan: () => Promise<void>;
  deletePlan: () => Promise<{ success: boolean; msg?: string }>;
};

const WorkoutPlanContext = createContext<WorkoutPlanContextType | null>(null);

export const WorkoutPlanProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.uid) {
      loadWorkoutPlan();
      clearExpiredCache(); // Cleans expired cache on startup
    } else {
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
    console.log("[WorkoutPlanContext] Loading workout plan for user:", user.uid);

    //  Try to load from cache
    const cachedPlan = await getCachedWorkoutPlan();
    if (cachedPlan) {
      console.log(" [WorkoutPlanContext] Using cached workout plan");
      setWorkoutPlan(cachedPlan);
      setLoading(false);
      
      // Synchronize in background
      syncPlanInBackground();
      return;
    }

    //  Load from Firebase
    const result = await getUserWorkoutPlan(user.uid);
    if (result.success && result.data) {
      console.log("[WorkoutPlanContext] Plan loaded from Firebase:", result.data.id);
      setWorkoutPlan(result.data);
      
      // Save to cache
      await cacheWorkoutPlan(result.data);
    } else {
      console.log("[WorkoutPlanContext] No plan found for user");
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
        console.log(" [WorkoutPlanContext] Background sync completed");
      }
    } catch (error) {
      console.error("[WorkoutPlanContext] Background sync failed:", error);
    }
  };

  const updateDay = async (day: string, dayData: DayWorkout) => {
    if (!user?.uid) {
      console.log("[WorkoutPlanContext] updateDay aborted, no user");
      return;
    }

    console.log("[WorkoutPlanContext] updateDay", day, dayData);

    if (!workoutPlan) {
      const defaultDays: DayWorkout[] = [
        { day: "Day 1", isRestDay: false, exercises: [] },
      ];

      const updatedDays = defaultDays.map((d) => (d.day === day ? dayData : d));

      const newLocalPlan: WorkoutPlan = {
        userID: user.uid,
        planName: "",
        splitDays: 1,
        days: updatedDays,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log("[WorkoutPlanContext] Setting local plan (no backend call)");
      setWorkoutPlan(newLocalPlan);
      
      // Save to cache
      await cacheWorkoutPlan(newLocalPlan);
      
      return;
    }

    const existingDay = workoutPlan.days.find((d) => d.day === day);
    let updatedDays: DayWorkout[];

    if (existingDay) {
      updatedDays = workoutPlan.days.map((d) => (d.day === day ? dayData : d));
    } else {
      updatedDays = [...workoutPlan.days, dayData];
    }

    const updatedPlan: WorkoutPlan = {
      ...workoutPlan,
      days: updatedDays,
      updatedAt: new Date(),
    };

    // Update UI immediately
    setWorkoutPlan(updatedPlan);
    
    // Save to cache
    await cacheWorkoutPlan(updatedPlan);

    // Update in Firebase
    if (workoutPlan.id) {
      try {
        console.log("[WorkoutPlanContext] Updating plan in Firebase:", workoutPlan.id);
        await updateWorkoutPlan(workoutPlan.id, updatedPlan);
      } catch (err) {
        console.error("[WorkoutPlanContext] Error updating plan on backend:", err);
      }
    } else {
      console.log("[WorkoutPlanContext] Updated local plan (no id)");
    }
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
        setWorkoutPlan(null);
        
        // Delete from cache
        await cacheWorkoutPlan(null as any);
        
        return { success: true, msg: result.msg || "Workout plan deleted successfully" };
      }
      return result;
    } catch (error: any) {
      console.error("[WorkoutPlanContext] Error deleting plan:", error);
      return { success: false, msg: error?.message || "Could not delete workout plan" };
    }
  };

  return (
    <WorkoutPlanContext.Provider
      value={{
        workoutPlan,
        loading,
        updateDay,
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