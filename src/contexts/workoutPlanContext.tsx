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

      const newPlan: WorkoutPlan = {
        userID: user.uid,
        planName: "My Plan",
        days: updatedDays,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log("[WorkoutPlanContext] creating new plan with payload:", newPlan);
      const createResult = await createWorkoutPlan(newPlan);
      if (createResult.success && createResult.data?.id) {
        console.log("[WorkoutPlanContext] created plan id:", createResult.data.id);
        setWorkoutPlan({ ...newPlan, id: createResult.data.id });
      } else {
        console.error("Failed to create workout plan:", createResult.msg);
      }

      return;
    }

    const updatedDays = workoutPlan.days.map((d) => (d.day === day ? dayData : d));

    const updatedPlan = {
      ...workoutPlan,
      days: updatedDays,
      updatedAt: new Date(),
    };

    try {
      if (workoutPlan.id) {
        console.log("[WorkoutPlanContext] updating plan id:", workoutPlan.id, "payload:", updatedPlan);
        await updateWorkoutPlan(workoutPlan.id, updatedPlan);
      } else {
        console.log("[WorkoutPlanContext] fallback create plan payload:", updatedPlan);
        const createResult = await createWorkoutPlan(updatedPlan);
        if (createResult.success && createResult.data?.id) {
          updatedPlan.id = createResult.data.id;
          console.log("[WorkoutPlanContext] created plan id (fallback):", createResult.data.id);
        }
      }
    } catch (err) {
      console.error("Error updating/creating plan:", err);
    }

    setWorkoutPlan(updatedPlan);
  };

  const refreshPlan = async () => {
    await loadWorkoutPlan();
  };

  const deletePlan = async (): Promise<{ success: boolean; msg?: string }> => {
    if (!workoutPlan?.id) {
      return { success: false, msg: "No workout plan to delete" };
    }

    try {
      const result = await deleteWorkoutPlan(workoutPlan.id);
      if (result.success) {
        setWorkoutPlan(null);
        return { success: true, msg: "Workout plan deleted successfully" };
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