/**
 * workoutDraftService.ts
 *
 * Persists an in-progress workout session to AsyncStorage so it survives
 * app crashes, background kills, or accidental navigation.
 *
 * Usage in addWorkout.tsx:
 *   - On every meaningful state change (exercise add/remove, set update, timer tick) → saveDraft()
 *   - On component mount → loadDraft() → if draft exists, show "Resume workout?" dialog
 *   - On successful save or explicit discard → clearDraft()
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Storage keys ────────────────────────────────────────────────────────────
const DRAFT_KEY = "@workout_draft_v1";
const DRAFT_TIMESTAMP_KEY = "@workout_draft_timestamp_v1";
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours — auto-expire stale drafts

// ─── Types ───────────────────────────────────────────────────────────────────

export type WorkoutSetDraft = {
  reps: number;
  weight: number;
  weightUnit: "kg" | "lbs";
};

export type WorkoutExerciseDraft = {
  exerciseName: string;
  sets: WorkoutSetDraft[];
};

export type WorkoutDraft = {
  /** Unix ms timestamp when the draft was last saved */
  savedAt: number;
  /** Accumulated timer seconds */
  totalTime: number;
  /** Current page: 0 = Timer, 1 = Workout Log */
  activePage: number;
  /** The target date for the workout (YYYY-MM-DD string) */
  targetDate: string;
  /** Exercises and their sets */
  exercises: WorkoutExerciseDraft[];
};

// ─── Internal helpers ────────────────────────────────────────────────────────

const isExpired = (timestamp: number): boolean => {
  return Date.now() - timestamp > DRAFT_MAX_AGE_MS;
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Save the current workout draft to AsyncStorage.
 * Call this on every meaningful state change (debounced in the component).
 */
export const saveWorkoutDraft = async (draft: WorkoutDraft): Promise<void> => {
  try {
    const payload = JSON.stringify({
      ...draft,
      savedAt: Date.now(),
    });
    await AsyncStorage.multiSet([
      [DRAFT_KEY, payload],
      [DRAFT_TIMESTAMP_KEY, String(Date.now())],
    ]);
  } catch (error) {
    if (__DEV__) {
      console.warn("[WorkoutDraft] Failed to save draft:", error);
    }
  }
};

/**
 * Load the persisted workout draft.
 * Returns `null` if no draft exists or if the draft is older than 24 hours.
 */
export const loadWorkoutDraft = async (): Promise<WorkoutDraft | null> => {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;

    const draft: WorkoutDraft = JSON.parse(raw);

    // Auto-expire stale drafts (older than 24 hours)
    if (!draft.savedAt || isExpired(draft.savedAt)) {
      await clearWorkoutDraft();
      return null;
    }

    return draft;
  } catch (error) {
    if (__DEV__) {
      console.warn("[WorkoutDraft] Failed to load draft:", error);
    }
    return null;
  }
};

/**
 * Remove the persisted workout draft.
 * Call after successful save or explicit user discard.
 */
export const clearWorkoutDraft = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([DRAFT_KEY, DRAFT_TIMESTAMP_KEY]);
  } catch (error) {
    if (__DEV__) {
      console.warn("[WorkoutDraft] Failed to clear draft:", error);
    }
  }
};

/**
 * Check whether a draft exists (without loading the full payload).
 */
export const hasWorkoutDraft = async (): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return false;

    const draft: WorkoutDraft = JSON.parse(raw);
    if (!draft.savedAt || isExpired(draft.savedAt)) {
      await clearWorkoutDraft();
      return false;
    }
    return true;
  } catch {
    return false;
  }
};