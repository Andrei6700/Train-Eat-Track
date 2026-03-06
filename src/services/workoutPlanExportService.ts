import { WorkoutHistory, WorkoutPlan, WorkoutSet } from "@/src/types/index";
import { DAY_IN_MS, startOfDay, toDateKey, toValidDate } from "@/src/utils/dateKey";
import { getCycleDayNameFromDate } from "@/src/utils/workoutPlanCycle";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import * as XLSX from "xlsx";

type ExportWorkoutPlanInput = {
  workoutPlan?: WorkoutPlan | null;
  workoutsHistory: WorkoutHistory[];
  userName?: string | null;
  userEmail?: string | null;
};

type ExportWorkoutPlanResult = {
  success: boolean;
  msg?: string;
  fileName?: string;
  fileUri?: string;
};

type WorkoutWithSavedAt = WorkoutHistory & {
  savedAt?: Date | string;
};

type NormalizedWorkout = WorkoutHistory & {
  parsedDateTime: Date;
  parsedDate: Date;
  dayKey: string;
};

type LoggedDay = {
  dayKey: string;
  date: Date;
  weekNumber: number;
  workouts: NormalizedWorkout[];
};

type ExerciseRow = {
  exerciseName: string;
  workingSetLabels: string[];
};

const formatDateForFileName = (date: Date): string => {
  return toDateKey(date).replace(/-/g, "");
};

const sanitizeFileNamePart = (value: string): string => {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const sanitized = normalized
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized || "Plan";
};

const sanitizeSheetName = (value: string): string => {
  const cleaned = value.replace(/[\\/*?:[\]]/g, "_").trim();
  const fallback = cleaned || "cycle 1";
  return fallback.slice(0, 31);
};

const normalizeWorkouts = (workoutsHistory: WorkoutHistory[]): NormalizedWorkout[] => {
  return workoutsHistory
    .map((workout) => {
      const workoutWithSavedAt = workout as WorkoutWithSavedAt;
      const parsedDateTime = toValidDate(
        workoutWithSavedAt.date ?? workoutWithSavedAt.savedAt,
      );
      if (!parsedDateTime) return null;

      const parsedDate = startOfDay(parsedDateTime);

      return {
        ...workout,
        parsedDateTime,
        parsedDate,
        dayKey: toDateKey(parsedDate),
      };
    })
    .filter((workout): workout is NormalizedWorkout => workout !== null)
    .sort((a, b) => a.parsedDateTime.getTime() - b.parsedDateTime.getTime());
};

const groupLoggedDays = (workouts: NormalizedWorkout[]): LoggedDay[] => {
  if (workouts.length === 0) return [];

  const groupedByDay = new Map<string, LoggedDay>();

  for (const workout of workouts) {
    const existing = groupedByDay.get(workout.dayKey);
    if (existing) {
      existing.workouts.push(workout);
      continue;
    }

    groupedByDay.set(workout.dayKey, {
      dayKey: workout.dayKey,
      date: workout.parsedDate,
      weekNumber: 1,
      workouts: [workout],
    });
  }

  const days = [...groupedByDay.values()].sort(
    (left, right) => left.date.getTime() - right.date.getTime(),
  );

  const rangeStart = days[0].date;
  for (const day of days) {
    const dayOffset = Math.floor(
      (day.date.getTime() - rangeStart.getTime()) / DAY_IN_MS,
    );
    day.weekNumber = Math.floor(dayOffset / 7) + 1;
  }

  return days;
};

const normalizeSetValue = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? `${value}` : `${value}`;
};

const formatSetLabel = (set: WorkoutSet): string => {
  const weight = normalizeSetValue(Number(set.weight));
  const reps = normalizeSetValue(Number(set.reps));
  const unit = set.weightUnit || "kg";
  return `${weight}${unit} x ${reps}`;
};

const detectWorkingSets = (sets: WorkoutSet[]): WorkoutSet[] => {
  if (!Array.isArray(sets) || sets.length === 0) return [];

  const validSets = sets.filter((set) => {
    const reps = Number(set.reps);
    const weight = Number(set.weight);
    return Number.isFinite(reps) && reps > 0 && Number.isFinite(weight);
  });

  if (validSets.length === 0) return [];

  const maxWeight = Math.max(...validSets.map((set) => Number(set.weight)));
  const firstTopSetIndex = validSets.findIndex(
    (set) => Number(set.weight) === maxWeight,
  );

  if (firstTopSetIndex < 0) return validSets;
  return validSets.slice(firstTopSetIndex);
};

const buildExerciseRowsForDay = (workouts: NormalizedWorkout[]): ExerciseRow[] => {
  const rows: ExerciseRow[] = [];

  for (const workout of workouts) {
    if (workout.isRestDay) continue;

    const exercises = workout.exercises || [];
    for (let exerciseIndex = 0; exerciseIndex < exercises.length; exerciseIndex += 1) {
      const exercise = exercises[exerciseIndex];
      const exerciseName =
        exercise.exerciseName?.trim() || `Exercise ${exerciseIndex + 1}`;
      const workingSets = detectWorkingSets(exercise.sets || []);
      const workingSetLabels = workingSets.map(formatSetLabel);

      rows.push({
        exerciseName,
        workingSetLabels,
      });
    }
  }

  return rows;
};

const buildSheetRows = (
  loggedDays: LoggedDay[],
  workoutPlan?: WorkoutPlan | null,
): { rows: (string | number)[][]; maxWorkingSetColumns: number } => {
  const rows: (string | number)[][] = [];
  let currentWeek = -1;
  let maxWorkingSetColumns = 1;
  const hasPlan = Boolean(workoutPlan && Array.isArray(workoutPlan.days));

  for (const day of loggedDays) {
    if (day.weekNumber !== currentWeek) {
      if (rows.length > 0) rows.push([]);
      rows.push([`WEEK ${day.weekNumber}`]);
      rows.push([]);
      currentWeek = day.weekNumber;
    }

    const cycleDayLabel = hasPlan
      ? getCycleDayNameFromDate(day.date, workoutPlan)
      : null;
    const dayLabel = cycleDayLabel
      ? `${day.dayKey} - ${cycleDayLabel}`
      : day.dayKey;
    rows.push([dayLabel]);

    const dayHasRestLog = day.workouts.some((workout) => workout.isRestDay);
    const exerciseRows = buildExerciseRowsForDay(day.workouts);

    if (exerciseRows.length === 0 && dayHasRestLog) {
      rows.push(["Rest day planned"]);
      rows.push([]);
      continue;
    }

    rows.push(["EXERCITIU", "SETURI", "REPETARI"]);

    if (exerciseRows.length === 0) {
      rows.push(["No exercises logged", 0, "-"]);
      rows.push([]);
      continue;
    }

    for (const exerciseRow of exerciseRows) {
      const workingSetsCount = exerciseRow.workingSetLabels.length;
      maxWorkingSetColumns = Math.max(maxWorkingSetColumns, workingSetsCount || 1);

      const row: (string | number)[] = [
        exerciseRow.exerciseName,
        workingSetsCount,
      ];

      if (workingSetsCount === 0) {
        row.push("-");
      } else {
        row.push(...exerciseRow.workingSetLabels);
      }

      rows.push(row);
    }

    rows.push([]);
  }

  return { rows, maxWorkingSetColumns };
};

export const exportWorkoutPlanToExcel = async (
  input: ExportWorkoutPlanInput,
): Promise<ExportWorkoutPlanResult> => {
  try {
    const normalizedWorkouts = normalizeWorkouts(input.workoutsHistory || []);
    if (normalizedWorkouts.length === 0) {
      return {
        success: false,
        msg: "No valid workouts found for export.",
      };
    }

    const loggedDays = groupLoggedDays(normalizedWorkouts);
    if (loggedDays.length === 0) {
      return {
        success: false,
        msg: "No valid workouts found for export.",
      };
    }

    const rangeStart = loggedDays[0].date;
    const rangeEnd = loggedDays[loggedDays.length - 1].date;

    const { rows, maxWorkingSetColumns } = buildSheetRows(
      loggedDays,
      input.workoutPlan,
    );

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 42 },
      { wch: 10 },
      ...Array.from({ length: maxWorkingSetColumns }, () => ({ wch: 18 })),
    ];

    const sheetName = sanitizeSheetName(
      input.workoutPlan?.planName?.trim() || "cycle 1",
    );
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const planName = input.workoutPlan?.planName?.trim() || "Workout Plan";
    const sanitizedPlanName = sanitizeFileNamePart(planName);
    const fileName = `WorkoutPlan_${sanitizedPlanName}_${formatDateForFileName(rangeStart)}_${formatDateForFileName(rangeEnd)}.xlsx`;

    if (Platform.OS === "web") {
      XLSX.writeFile(workbook, fileName, { bookType: "xlsx" });
      return {
        success: true,
        fileName,
      };
    }

    if (!FileSystem.cacheDirectory) {
      return {
        success: false,
        msg: "Could not access local cache directory.",
      };
    }

    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    const workbookBase64 = XLSX.write(workbook, {
      type: "base64",
      bookType: "xlsx",
      compression: true,
    });

    await FileSystem.writeAsStringAsync(fileUri, workbookBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      return {
        success: false,
        msg: "Sharing is not available on this device.",
        fileName,
        fileUri,
      };
    }

    await Sharing.shareAsync(fileUri, {
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      UTI: "org.openxmlformats.spreadsheetml.sheet",
      dialogTitle: "Export Workout Plan",
    });

    return {
      success: true,
      fileName,
      fileUri,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Could not export workout plan";

    return {
      success: false,
      msg: message,
    };
  }
};
