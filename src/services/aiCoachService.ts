import { WorkoutHistory } from "@/src/types/index";

// Cache for unnecessary recalculations
let cachedTip: { tip: string; emoji: string; timestamp: number } | null = null;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

export type CoachTip = {
  tip: string;
  emoji: string;
  type: "motivational" | "warning" | "suggestion" | "congratulation";
};

/**
 * Helper to calculate days since last workout
 */
const calculateDaysSince = (lastWorkoutDate: Date | null): number => {
  if (!lastWorkoutDate) return 999;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastDate = new Date(lastWorkoutDate);
  lastDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

/**
 * Calculates the current streak (consecutive workout days)
 */
const calculateStreak = (workouts: WorkoutHistory[]): number => {
  if (workouts.length === 0) return 0;

  // Sort workouts in descending order by date
  const sortedWorkouts = [...workouts].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  for (const workout of sortedWorkouts) {
    const workoutDate = new Date(workout.date);
    workoutDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor(
      (currentDate.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === streak) {
      streak++;
      currentDate = workoutDate;
    } else if (diffDays === streak + 1) {
      // Allow one day gap
      streak++;
      currentDate = workoutDate;
    } else {
      break;
    }
  }

  return streak;
};

/**
 * Detects the type of the last workout (Leg, Push, Pull, etc.)
 */
const getLastWorkoutType = (lastWorkout: WorkoutHistory | null): string => {
  if (
    !lastWorkout ||
    !lastWorkout.exercises ||
    lastWorkout.exercises.length === 0
  ) {
    return "unknown";
  }

  const exercises = lastWorkout.exercises.map((ex) =>
    ex.exerciseName.toLowerCase(),
  );

  // Leg day detection
  if (
    exercises.some(
      (ex) =>
        ex.includes("squat") ||
        ex.includes("leg") ||
        ex.includes("lunge") ||
        ex.includes("calf"),
    )
  ) {
    return "Leg";
  }

  // Push day detection
  if (
    exercises.some(
      (ex) =>
        ex.includes("bench") ||
        ex.includes("press") ||
        ex.includes("chest") ||
        ex.includes("shoulder") ||
        ex.includes("tricep"),
    )
  ) {
    return "Push";
  }

  // Pull day detection
  if (
    exercises.some(
      (ex) =>
        ex.includes("pull") ||
        ex.includes("row") ||
        ex.includes("back") ||
        ex.includes("bicep") ||
        ex.includes("lat"),
    )
  ) {
    return "Pull";
  }

  // Cardio detection
  if (
    exercises.some(
      (ex) =>
        ex.includes("run") ||
        ex.includes("cardio") ||
        ex.includes("treadmill") ||
        ex.includes("bike"),
    )
  ) {
    return "Cardio";
  }

  return "Full Body";
};

/**
 * Generates an AI Coach tip based on workout history
 */
export const getAICoachTip = (workouts: WorkoutHistory[]): CoachTip => {
  // Check cache first
  if (cachedTip && Date.now() - cachedTip.timestamp < CACHE_DURATION) {
    return {
      tip: cachedTip.tip,
      emoji: cachedTip.emoji,
      type: "motivational",
    };
  }

  // If no workouts, return beginner tip
  if (workouts.length === 0) {
    const tip = "Time to start your fitness journey! ";
    cachedTip = { tip, emoji: "", timestamp: Date.now() };
    return { tip, emoji: "", type: "suggestion" };
  }

  // Sort workouts to find last workout
  const sortedWorkouts = [...workouts].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });

  const lastWorkout = sortedWorkouts[0];
  const daysSince = calculateDaysSince(new Date(lastWorkout.date));
  const lastWorkoutType = getLastWorkoutType(lastWorkout);
  const streak = calculateStreak(workouts);

  let tip: CoachTip;

  // Generate tip based on days since last workout
  if (daysSince === 0) {
    // Today workout already done
    tip = {
      tip: "Already trained today! Great job! Rest & recover ",
      type: "congratulation",
    };
  } else if (daysSince === 1) {
    // Workout done yesterday
    if (lastWorkoutType === "Leg") {
      tip = {
        tip: "Great leg session yesterday! Focus on protein today ",
        type: "suggestion",
      };
    } else if (lastWorkoutType === "Push") {
      tip = {
        tip: "Chest feeling sore? Perfect! Time for some pull exercises ",
        type: "suggestion",
      };
    } else if (lastWorkoutType === "Pull") {
      tip = {
        tip: "Back day done! How about hitting legs or push today? ",
        type: "suggestion",
      };
    } else {
      tip = {
        tip: "Awesome workout yesterday! Keep the momentum going ",
        type: "motivational",
      };
    }
  } else if (daysSince === 2) {
    // 2 days since last workout
    tip = {
      tip: "Ready for another session? Your muscles have recovered! ",
      type: "suggestion",
    };
  } else if (daysSince >= 3 && daysSince <= 5) {
    // 3-5 days since last workout
    tip = {
      tip: "Missed you! How about a light 20 min cardio today? ",
      type: "warning",
    };
  } else if (daysSince > 5) {
    // More than 5 days since last workout
    tip = {
      tip: "Let's get back on track! Even a quick workout counts ",
      type: "warning",
    };
  } else {
    // Default
    tip = {
      tip: "Consistency is key! You're doing great ",
      type: "motivational",
    };
  }

  // Streak bonus messages
  if (streak >= 7) {
    tip = {
      tip: `${streak} day streak! You're unstoppable! `,
      type: "congratulation",
    };
  } else if (streak >= 5) {
    tip = {
      tip: `${streak} days in a row! Keep crushing it! `,
      type: "congratulation",
    };
  } else if (streak >= 3) {
    tip = {
      tip: `${streak} day streak! Momentum is building `,
      type: "motivational",
    };
  }

  // Cache the result
  cachedTip = { tip: tip.tip, emoji: tip.emoji, timestamp: Date.now() };

  return tip;
};

/**
 * Invalidates the cached AI Coach tip
 */
export const invalidateCoachCache = () => {
  cachedTip = null;
};
