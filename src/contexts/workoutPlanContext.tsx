import { useAuth } from "@/src/contexts/authContext";
import {
  createWorkoutPlan,
  deleteWorkoutPlan,
  getUserWorkoutPlan,
  updateWorkoutPlan,
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
    console.log("[WorkoutPlanContext] loadWorkoutPlan for user:", user.uid);
    const result = await getUserWorkoutPlan(user.uid);
    if (result.success && result.data) {
      console.log("[WorkoutPlanContext] plan found:", result.data.id);
      setWorkoutPlan(result.data);
    } else {
      console.log("[WorkoutPlanContext] no plan found for user");
      setWorkoutPlan(null);
    }
    setLoading(false);
  };

  const updateDay = async (day: string, dayData: DayWorkout) => {
    if (!user?.uid) {
      console.log("[WorkoutPlanContext] updateDay aborted, no user");
      return;
    }

    console.log("[WorkoutPlanContext] updateDay", day, dayData);

    if (!workoutPlan) {
      const defaultDays: DayWorkout[] = [
        { day: "Luni", isRestDay: false, exercises: [] },
        { day: "Marti", isRestDay: false, exercises: [] },
        { day: "Miercuri", isRestDay: false, exercises: [] },
        { day: "Joi", isRestDay: false, exercises: [] },
        { day: "Vineri", isRestDay: false, exercises: [] },
        { day: "Sambata", isRestDay: false, exercises: [] },
        { day: "Duminica", isRestDay: false, exercises: [] },
      ];

      const updatedDays = defaultDays.map((d) => (d.day === day ? dayData : d));

      const newLocalPlan: WorkoutPlan = {
        userID: user.uid,
        planName: "",
        days: updatedDays,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log("[WorkoutPlanContext] set local plan (no backend call). Payload:", newLocalPlan);
      setWorkoutPlan(newLocalPlan);
      return;
    }

    const updatedDays = workoutPlan.days.map((d) => (d.day === day ? dayData : d));

    const updatedPlan: WorkoutPlan = {
      ...workoutPlan,
      days: updatedDays,
      updatedAt: new Date(),
    };

    if (workoutPlan.id) {
      try {
        console.log("[WorkoutPlanContext] updating plan id:", workoutPlan.id, "payload:", updatedPlan);
        await updateWorkoutPlan(workoutPlan.id, updatedPlan);
      } catch (err) {
        console.error("[WorkoutPlanContext] error updating plan on backend:", err);
      }
    } else {
      console.log("[WorkoutPlanContext] updated local plan (no id) – waiting for explicit Save:", updatedPlan);
    }

    setWorkoutPlan(updatedPlan);
  };

  const refreshPlan = async () => {
    await loadWorkoutPlan();
  };

  // ✅ MODIFICAT: Trimite userID la funcția de delete
  const deletePlan = async (): Promise<{ success: boolean; msg?: string }> => {
    if (!workoutPlan?.id || !user?.uid) {
      return { success: false, msg: "No workout plan to delete" };
    }

    try {
      const result = await deleteWorkoutPlan(workoutPlan.id, user.uid);
      if (result.success) {
        setWorkoutPlan(null);
        return { success: true, msg: result.msg || "Workout plan and history deleted successfully" };
      }
      return result;
    } catch (error: any) {
      console.error("[WorkoutPlanContext] error deleting plan:", error);
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