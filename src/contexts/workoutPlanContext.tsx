import { useAuth } from "@/src/contexts/authContext";
import {
  getUserWorkoutPlan,
  updateWorkoutPlan,
  createWorkoutPlan,
} from "@/src/services/workoutPlanService";
import { DayWorkout, WorkoutPlan } from "@/src/types/index";
import React, { createContext, useContext, useEffect, useState } from "react";

type WorkoutPlanContextType = {
  workoutPlan: WorkoutPlan | null;
  loading: boolean;
  updateDay: (day: string, dayData: DayWorkout) => Promise<void>;
  refreshPlan: () => Promise<void>;
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
      // no user
      setWorkoutPlan(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const loadWorkoutPlan = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await getUserWorkoutPlan(user.uid);
    if (result.success && result.data) {
      setWorkoutPlan(result.data);
    } else {
      setWorkoutPlan(null);
    }
    setLoading(false);
  };

  const updateDay = async (day: string, dayData: DayWorkout) => {
    if (!user?.uid) return;

    // If no local plan exists, create a new one using the updated day
    if (!workoutPlan) {
      // build default 7-day skeleton
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

      const createResult = await createWorkoutPlan(newPlan);
      if (createResult.success && createResult.data?.id) {
        // set local plan with id
        setWorkoutPlan({ ...newPlan, id: createResult.data.id });
      } else {
        // creation failed - keep nothing but don't throw (UI shows success previously — keep behavior)
        console.error("Failed to create workout plan:", createResult.msg);
      }

      return;
    }

    // Update existing plan locally & remote
    const updatedDays = workoutPlan.days.map((d) => (d.day === day ? dayData : d));

    const updatedPlan = {
      ...workoutPlan,
      days: updatedDays,
      updatedAt: new Date(),
    };

    // Save to firebase (if id exists)
    try {
      if (workoutPlan.id) {
        await updateWorkoutPlan(workoutPlan.id, updatedPlan);
      } else {
        // fallback: create if somehow no id
        const createResult = await createWorkoutPlan(updatedPlan);
        if (createResult.success && createResult.data?.id) {
          updatedPlan.id = createResult.data.id;
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

  return (
    <WorkoutPlanContext.Provider
      value={{
        workoutPlan,
        loading,
        updateDay,
        refreshPlan,
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
