import { DayWorkout, WorkoutSet } from "@/src/types/index";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";

type SupportedImportFormat =
  | "DAY_NUMBER_TABLE"
  | "WEEK_EXERCITIU"
  | "WEEK_WORKING_SETS";

type ImportErrorCode =
  | "PICKER_CANCELLED"
  | "INVALID_FILE_TYPE"
  | "READ_FAILED"
  | "UNSUPPORTED_FORMAT"
  | "PARSE_FAILED";

export type ImportedWorkoutPlanDraft = {
  planName: string;
  splitDays: number;
  days: DayWorkout[];
};

export type ImportWorkoutPlanResult = {
  success: boolean;
  code?: ImportErrorCode;
  msg?: string;
  errors?: string[];
  data?: ImportedWorkoutPlanDraft;
};

type FormatDetectionResult = {
  format: SupportedImportFormat;
  sheetName: string;
  rows: string[][];
};

type ParseResult =
  | {
    success: true;
    splitDays: number;
    days: DayWorkout[];
  }
  | {
    success: false;
    errors: string[];
  };

type DayRowsAccumulator = Map<number, DayWorkout>;

const MAX_IMPORT_ERRORS = 25;

const normalizeCell = (value: unknown): string =>
  String(value ?? "").replace(/\r?\n/g, " ").trim();

const normalizeRow = (row: unknown[]): string[] => row.map(normalizeCell);

const rowHasValues = (row: string[]): boolean => row.some((cell) => cell !== "");

const getFirstNonEmptyCellIndex = (row: string[]): number =>
  row.findIndex((cell) => cell !== "");

const getNonEmptyCells = (row: string[]): string[] => row.filter((cell) => cell !== "");

const isWeekMarker = (value: string): boolean => /^week\s*\d+$/i.test(value);

const isDayNumberLabel = (value: string): number | null => {
  const match = value.match(/\bday\s*(\d+)\b/i);
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const isRestLabel = (value: string): boolean => /\b(rest|pauza|odihna)\b/i.test(value);

const isPlaceholderValue = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return normalized === "n/a" || normalized === "na";
};

const isExerciseCandidate = (value: string): boolean => {
  if (isPlaceholderValue(value)) return false;
  const normalized = value.trim();
  if (!normalized) return false;
  if (/^set\s*\d+$/i.test(normalized)) return false;
  if (isWeekMarker(normalized)) return false;
  return /[a-z]/i.test(normalized);
};

const parsePositiveIntMin = (value: string): number | null => {
  const matches = value.match(/\d+/g);
  if (!matches?.length) return null;
  const parsed = Number.parseInt(matches[0], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const parseWeightValue = (value: string): number | null => {
  if (!value) return 0;
  const normalized = value.replace(",", ".");
  const match = normalized.match(/-?\d+(\.\d+)?/);
  if (!match?.[0]) return null;
  const parsed = Number.parseFloat(match[0]);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const parseMinRepValue = (value: string): number | null => {
  if (!value) return null;
  const normalized = value.replace(",", ".");
  const match = normalized.match(/(\d+(\.\d+)?)/);
  if (!match?.[1]) return null;
  const parsed = Number.parseFloat(match[1]);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
};

const parseRepsForSets = (value: string, setsCount: number): number[] | null => {
  if (setsCount <= 0) return null;

  const tokens = value
    .split(/[,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const reps: number[] = [];

  for (const token of tokens) {
    const multiplierMatch = token.match(/^(\d+)\s*x\s*(.+)$/i);
    if (multiplierMatch?.[1] && multiplierMatch[2]) {
      const repeatCount = Number.parseInt(multiplierMatch[1], 10);
      const minRep = parseMinRepValue(multiplierMatch[2]);
      if (!Number.isFinite(repeatCount) || repeatCount <= 0 || minRep === null) {
        continue;
      }
      for (let index = 0; index < repeatCount; index += 1) {
        reps.push(minRep);
      }
      continue;
    }

    const minRep = parseMinRepValue(token);
    if (minRep !== null) {
      reps.push(minRep);
    }
  }

  if (reps.length === 0) {
    const single = parseMinRepValue(value);
    if (single === null) return null;
    reps.push(single);
  }

  if (reps.length > setsCount) {
    return reps.slice(0, setsCount);
  }

  const fillValue = reps[reps.length - 1] ?? 0;
  while (reps.length < setsCount) {
    reps.push(fillValue);
  }

  return reps;
};

const makeSets = (count: number, reps: number[], weight: number): WorkoutSet[] => {
  return Array.from({ length: count }, (_, index) => ({
    reps: reps[index] ?? reps[reps.length - 1] ?? 0,
    weight,
    weightUnit: "kg" as const,
  }));
};

const pushImportError = (errors: string[], message: string) => {
  if (errors.length >= MAX_IMPORT_ERRORS) return;
  errors.push(message);
};

const getOrInitDay = (
  daysByNumber: DayRowsAccumulator,
  dayNumber: number,
  isRestDay = false,
): DayWorkout => {
  const existing = daysByNumber.get(dayNumber);
  if (existing) {
    if (isRestDay) {
      existing.isRestDay = true;
      existing.exercises = [];
    }
    return existing;
  }

  const nextDay: DayWorkout = {
    day: `Day ${dayNumber}`,
    isRestDay,
    exercises: [],
  };
  daysByNumber.set(dayNumber, nextDay);
  return nextDay;
};

const fillMissingDays = (daysByNumber: DayRowsAccumulator, splitDays: number): DayWorkout[] => {
  const filled: DayWorkout[] = [];
  for (let dayNumber = 1; dayNumber <= splitDays; dayNumber += 1) {
    const existing = daysByNumber.get(dayNumber);
    if (existing) {
      filled.push({
        ...existing,
        day: `Day ${dayNumber}`,
      });
      continue;
    }

    filled.push({
      day: `Day ${dayNumber}`,
      isRestDay: true,
      exercises: [],
    });
  }

  return filled;
};

const detectHeaderColumns = (row: string[]) => {
  const lower = row.map((cell) => cell.toLowerCase());
  const exerciseIndex = lower.findIndex(
    (cell) => cell.includes("exercise") || cell.includes("exercitiu"),
  );
  const setsIndex = lower.findIndex(
    (cell) => cell === "sets" || cell.includes("seturi"),
  );
  const repsIndex = lower.findIndex(
    (cell) =>
      cell.startsWith("reps") ||
      cell.includes("repetari") ||
      cell.includes("reps range"),
  );
  const weightIndex = lower.findIndex((cell) => cell.includes("weight") || cell.includes("greutate"));

  if (exerciseIndex < 0 || setsIndex < 0 || repsIndex < 0) return null;

  return {
    exerciseIndex,
    setsIndex,
    repsIndex,
    weightIndex: weightIndex >= 0 ? weightIndex : null,
  };
};

const parseDayNumberTableFormat = (rows: string[][]): ParseResult => {
  const errors: string[] = [];
  const daysByNumber: DayRowsAccumulator = new Map();
  let currentDayNumber: number | null = null;
  let headerColumns:
    | {
      exerciseIndex: number;
      setsIndex: number;
      repsIndex: number;
      weightIndex: number | null;
    }
    | null = null;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!rowHasValues(row)) continue;

    for (const cell of row) {
      const dayFromCell = isDayNumberLabel(cell);
      if (dayFromCell) {
        currentDayNumber = dayFromCell;
        getOrInitDay(daysByNumber, dayFromCell, false);
        break;
      }
    }

    const columns = detectHeaderColumns(row);
    if (columns) {
      headerColumns = columns;
      continue;
    }

    if (!headerColumns || !currentDayNumber) continue;

    const exerciseName = row[headerColumns.exerciseIndex] || "";
    if (!exerciseName) continue;
    if (!isExerciseCandidate(exerciseName)) continue;

    const setsText = row[headerColumns.setsIndex] || "";
    const repsText = row[headerColumns.repsIndex] || "";
    const weightText =
      headerColumns.weightIndex !== null ? row[headerColumns.weightIndex] || "" : "";

    const setsCount = parsePositiveIntMin(setsText);
    if (!setsCount) {
      pushImportError(
        errors,
        `Row ${rowIndex + 1}: invalid sets for "${exerciseName}".`,
      );
      continue;
    }

    const reps = parseRepsForSets(repsText, setsCount);
    if (!reps) {
      pushImportError(
        errors,
        `Row ${rowIndex + 1}: invalid reps for "${exerciseName}".`,
      );
      continue;
    }

    const parsedWeight = parseWeightValue(weightText);
    if (parsedWeight === null) {
      pushImportError(
        errors,
        `Row ${rowIndex + 1}: invalid weight for "${exerciseName}".`,
      );
      continue;
    }

    const day = getOrInitDay(daysByNumber, currentDayNumber, false);
    day.exercises.push({
      exerciseName,
      sets: makeSets(setsCount, reps, parsedWeight),
    });
  }

  if (daysByNumber.size === 0) {
    return {
      success: false,
      errors: ["No day blocks were found in this Excel sheet."],
    };
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const splitDays = Math.max(...daysByNumber.keys());
  return {
    success: true,
    splitDays,
    days: fillMissingDays(daysByNumber, splitDays),
  };
};

const parseWeekExercitiuFormat = (rows: string[][]): ParseResult => {
  const errors: string[] = [];
  const daysByNumber: DayRowsAccumulator = new Map();
  let currentDayNumber = 0;
  let currentDay: DayWorkout | null = null;
  let inExerciseTable = false;

  const weekStartIndex = rows.findIndex((row) =>
    getNonEmptyCells(row).some((cell) => /^week\s*1$/i.test(cell)),
  );
  const startIndex = weekStartIndex >= 0 ? weekStartIndex + 1 : 0;

  let endIndex = rows.length;
  for (let index = startIndex; index < rows.length; index += 1) {
    const nonEmptyCells = getNonEmptyCells(rows[index]);
    if (
      nonEmptyCells.length === 1 &&
      /^week\s*(\d+)$/i.test(nonEmptyCells[0]) &&
      !/^week\s*1$/i.test(nonEmptyCells[0])
    ) {
      endIndex = index;
      break;
    }
  }

  for (let rowIndex = startIndex; rowIndex < endIndex; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!rowHasValues(row)) {
      inExerciseTable = false;
      continue;
    }

    const nonEmptyCells = getNonEmptyCells(row);
    const firstNonEmptyIndex = getFirstNonEmptyCellIndex(row);
    const firstValue = firstNonEmptyIndex >= 0 ? row[firstNonEmptyIndex] : "";
    if (!firstValue) continue;

    if (isWeekMarker(firstValue)) {
      break;
    }

    if (/^exercitiu$/i.test(firstValue)) {
      if (!currentDay) {
        currentDayNumber += 1;
        currentDay = getOrInitDay(daysByNumber, currentDayNumber, false);
      }
      inExerciseTable = true;
      continue;
    }

    if (nonEmptyCells.length === 1 && !inExerciseTable) {
      currentDayNumber += 1;
      currentDay = getOrInitDay(daysByNumber, currentDayNumber, isRestLabel(firstValue));
      continue;
    }

    if (!currentDay || !inExerciseTable || currentDay.isRestDay) {
      continue;
    }

    const exerciseName = row[0] || "";
    if (!isExerciseCandidate(exerciseName)) {
      continue;
    }

    const setsText = row[1] || "";
    const repsText = row[2] || "";

    if (!setsText && !repsText) {
      continue;
    }

    const setsCount = parsePositiveIntMin(setsText);
    if (!setsCount) {
      pushImportError(
        errors,
        `Row ${rowIndex + 1}: invalid sets for "${exerciseName}".`,
      );
      continue;
    }

    const reps = parseRepsForSets(repsText, setsCount);
    if (!reps) {
      pushImportError(
        errors,
        `Row ${rowIndex + 1}: invalid reps for "${exerciseName}".`,
      );
      continue;
    }

    currentDay.exercises.push({
      exerciseName,
      sets: makeSets(setsCount, reps, 0),
    });
  }

  if (daysByNumber.size === 0) {
    return {
      success: false,
      errors: ["No workout days were found in this Excel sheet."],
    };
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const splitDays = daysByNumber.size;
  return {
    success: true,
    splitDays,
    days: fillMissingDays(daysByNumber, splitDays),
  };
};

const isLikelyJeffDayLabel = (value: string): boolean => {
  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (/^day\s*\d+/.test(normalized)) return true;
  return /^(upper|lower|push|pull|legs?|full body)(\s*\(.*\))?$/.test(normalized);
};

const parseWeekWorkingSetsFormat = (rows: string[][]): ParseResult => {
  const errors: string[] = [];
  const daysByNumber: DayRowsAccumulator = new Map();
  const dayOrder: string[] = [];

  const headerRowIndex = rows.findIndex((row) => {
    const lower = row.map((cell) => cell.toLowerCase());
    return (
      lower.some((cell) => cell.startsWith("week")) &&
      lower.includes("exercise") &&
      lower.includes("working sets") &&
      lower.includes("reps")
    );
  });

  if (headerRowIndex < 0) {
    return {
      success: false,
      errors: ["No 'Week / Exercise / Working Sets / Reps' table was found."],
    };
  }

  const headerRow = rows[headerRowIndex].map((cell) => cell.toLowerCase());
  const exerciseColumn = headerRow.findIndex((cell) => cell === "exercise");
  const setsColumn = headerRow.findIndex((cell) => cell === "working sets");
  const repsColumn = headerRow.findIndex((cell) => cell === "reps");

  if (exerciseColumn < 0 || setsColumn < 0 || repsColumn < 0) {
    return {
      success: false,
      errors: ["Could not map Exercise / Working Sets / Reps columns."],
    };
  }

  let endIndex = rows.length;
  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const firstCell = rows[index][0] || "";
    if (/^week\s*(\d+)$/i.test(firstCell) && !/^week\s*1$/i.test(firstCell)) {
      endIndex = index;
      break;
    }
  }

  let currentDayLabel = "";

  for (let rowIndex = headerRowIndex + 1; rowIndex < endIndex; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!rowHasValues(row)) continue;

    const firstCell = row[0] || "";
    if (/^set\s*\d+$/i.test(firstCell)) {
      continue;
    }

    const potentialDayLabel = row[exerciseColumn - 1] || "";
    if (isLikelyJeffDayLabel(potentialDayLabel)) {
      currentDayLabel = potentialDayLabel;
      if (!dayOrder.includes(currentDayLabel)) {
        dayOrder.push(currentDayLabel);
        getOrInitDay(daysByNumber, dayOrder.length, false);
      }
    }

    const standardExercise = row[exerciseColumn] || "";
    const standardSets = row[setsColumn] || "";
    const standardReps = row[repsColumn] || "";
    const shiftedExercise = row[exerciseColumn - 1] || "";
    const shiftedSets = row[setsColumn - 1] || "";
    const shiftedReps = row[repsColumn - 1] || "";

    let exerciseName = standardExercise;
    let setsText = standardSets;
    let repsText = standardReps;

    if (!isExerciseCandidate(standardExercise) && isExerciseCandidate(shiftedExercise)) {
      exerciseName = shiftedExercise;
      setsText = shiftedSets;
      repsText = shiftedReps;
    }

    if (!isExerciseCandidate(exerciseName)) {
      continue;
    }

    if (!currentDayLabel) {
      pushImportError(
        errors,
        `Row ${rowIndex + 1}: exercise "${exerciseName}" appears before any day label.`,
      );
      continue;
    }

    const dayNumber = dayOrder.indexOf(currentDayLabel) + 1;
    if (dayNumber <= 0) continue;

    const setsCount = parsePositiveIntMin(setsText);
    if (!setsCount) {
      pushImportError(
        errors,
        `Row ${rowIndex + 1}: invalid working sets for "${exerciseName}".`,
      );
      continue;
    }

    const reps = parseRepsForSets(repsText, setsCount);
    if (!reps) {
      pushImportError(
        errors,
        `Row ${rowIndex + 1}: invalid reps for "${exerciseName}".`,
      );
      continue;
    }

    const day = getOrInitDay(daysByNumber, dayNumber, false);
    day.exercises.push({
      exerciseName,
      sets: makeSets(setsCount, reps, 0),
    });
  }

  if (daysByNumber.size === 0) {
    return {
      success: false,
      errors: ["No day blocks were extracted from Week 1."],
    };
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const splitDays = dayOrder.length || daysByNumber.size;
  return {
    success: true,
    splitDays,
    days: fillMissingDays(daysByNumber, splitDays),
  };
};

const detectFormatForSheet = (sheetName: string, rows: string[][]): FormatDetectionResult | null => {
  const hasDayNumber = rows.some((row) => row.some((cell) => isDayNumberLabel(cell) !== null));
  const hasExerciseHeader = rows.some((row) => {
    const lower = row.map((cell) => cell.toLowerCase());
    return lower.includes("exercise") && lower.some((cell) => cell.startsWith("sets"));
  });
  if (hasDayNumber && hasExerciseHeader) {
    return { format: "DAY_NUMBER_TABLE", sheetName, rows };
  }

  const hasExercitiuHeader = rows.some((row) => {
    const lower = row.map((cell) => cell.toLowerCase());
    return lower.includes("exercitiu") && lower.includes("seturi");
  });
  if (hasExercitiuHeader) {
    return { format: "WEEK_EXERCITIU", sheetName, rows };
  }

  const hasWeekWorkingSetsHeader = rows.some((row) => {
    const lower = row.map((cell) => cell.toLowerCase());
    return (
      lower.some((cell) => cell.startsWith("week")) &&
      lower.includes("exercise") &&
      lower.includes("working sets")
    );
  });
  if (hasWeekWorkingSetsHeader) {
    return { format: "WEEK_WORKING_SETS", sheetName, rows };
  }

  return null;
};

const extractRowsBySheet = (
  workbook: XLSX.WorkBook,
): { sheetName: string; rows: string[][] }[] => {
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
    }) as unknown[][];

    const rows = rawRows.map(normalizeRow);
    return { sheetName, rows };
  });
};

const derivePlanName = (fileName: string, fallbackSheetName: string): string => {
  const fromFileName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();

  if (fromFileName) return fromFileName;
  return fallbackSheetName.trim() || "Imported Plan";
};

const importWorkoutPlanWithAI = async (
  fileContent: string,
  fallbackPlanName: string
): Promise<ImportWorkoutPlanResult> => {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { success: false, code: "PARSE_FAILED", msg: "Groq API key not configured." };
  }

  const prompt = `You are a fitness data extraction assistant. Your task is to extract workout plan data from the provided text and return ONLY a raw JSON object. Do not add any conversational text or markdown blocks.

The JSON MUST EXACTLY MATCH this structure:
{
  "planName": "Name of the plan",
  "splitDays": 6,
  "days": [
    {
      "day": "Day 1",
      "notes": "Chest & Triceps",
      "isRestDay": false,
      "exercises": [
        {
          "exerciseName": "Bench Press",
          "sets": [
            { "reps": 8, "weight": 85, "weightUnit": "kg" },
            { "reps": 8, "weight": 85, "weightUnit": "kg" },
            { "reps": 8, "weight": 85, "weightUnit": "kg" },
            { "reps": 8, "weight": 85, "weightUnit": "kg" }
          ]
        }
      ]
    },
    {
      "day": "Day 3",
      "notes": "REST DAY",
      "isRestDay": true,
      "exercises": []
    }
  ]
}

Rules:
1. If no plan name is found, use "${fallbackPlanName}".
2. If it says "4 sets x 8 reps", you MUST generate an array with exactly 4 objects inside "sets", each having reps: 8.
3. If it is a rest day, set "isRestDay": true and "exercises": [].
4. Output ONLY valid JSON.

File content to parse:
${fileContent}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" },
        stream: false,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const lastError = await response.text();
      if (__DEV__) console.warn(`Groq API Error:`, lastError);
      return { success: false, code: "PARSE_FAILED", msg: "AI parsing failed: " + lastError };
    }

    const data = await response.json();
    let textResponse = data.choices?.[0]?.message?.content;

    if (!textResponse) {
      return { success: false, code: "PARSE_FAILED", msg: "Empty response from AI." };
    }

    if (__DEV__) console.log("RAW AI RESPONSE:", textResponse);

    // Clean potential markdown wrap if model ignored instructions
    textResponse = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(textResponse) as ImportedWorkoutPlanDraft;

    // Validate
    if (!parsed.days || !Array.isArray(parsed.days)) {
      return { success: false, code: "PARSE_FAILED", msg: "Invalid JSON structure from AI." };
    }

    if (!parsed.splitDays) parsed.splitDays = parsed.days.length;
    if (!parsed.planName) parsed.planName = fallbackPlanName;

    // Normalize formats
    parsed.days = parsed.days.map((day, idx) => ({
      day: `Day ${idx + 1}`,
      isRestDay: !!day.isRestDay,
      notes: day.notes || "",
      exercises: Array.isArray(day.exercises) ? day.exercises.map(ex => ({
        exerciseName: ex.exerciseName || "Unknown Exercise",
        sets: Array.isArray(ex.sets) ? ex.sets.map(s => ({
          reps: Number(s.reps) || 0,
          weight: Number(s.weight) || 0,
          weightUnit: s.weightUnit || "kg"
        })) : []
      })) : []
    }));

    return { success: true, data: parsed };
  } catch (error) {
    if (__DEV__) console.error(`Error in Groq import:`, error);
    return { success: false, code: "PARSE_FAILED", msg: "AI parsing failed due to network or JSON error." };
  }
};

export const importWorkoutPlanFromExcel = async (): Promise<ImportWorkoutPlanResult> => {
  try {
    const pickedFile = await DocumentPicker.getDocumentAsync({
      type: [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
        "text/plain",
        "application/json"
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (pickedFile.canceled) {
      return {
        success: false,
        code: "PICKER_CANCELLED",
      };
    }

    const pickedAsset = pickedFile.assets?.[0];
    if (!pickedAsset?.uri || !pickedAsset.name) {
      return {
        success: false,
        code: "READ_FAILED",
        msg: "Could not access the selected file.",
      };
    }

    const fileNameLower = pickedAsset.name.toLowerCase();
    const isExcel = fileNameLower.endsWith(".xlsx") || fileNameLower.endsWith(".xls");

    let fileTextForAI = "";
    const fallbackName = derivePlanName(pickedAsset.name, "Imported Plan");

    if (isExcel) {
      let fileBase64 = "";
      try {
        fileBase64 = await FileSystem.readAsStringAsync(pickedAsset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch {
        return {
          success: false,
          code: "READ_FAILED",
          msg: "Could not read the selected Excel file.",
        };
      }

      let workbook: XLSX.WorkBook;
      try {
        workbook = XLSX.read(fileBase64, {
          type: "base64",
          raw: false,
        });
      } catch {
        return {
          success: false,
          code: "READ_FAILED",
          msg: "The selected file is not a valid Excel workbook.",
        };
      }

      // Convert all sheets to a single text representation for AI
      fileTextForAI = workbook.SheetNames.map(name => {
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
        return `Sheet: ${name}\n${csv}`;
      }).join("\n\n");

      const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY;
      if (apiKey) {
        const aiResult = await importWorkoutPlanWithAI(fileTextForAI, fallbackName);
        if (aiResult.success) return aiResult;
        if (__DEV__) console.warn("AI parsing failed, falling back to manual Excel parsing.");
      }

      // Fallback manual Excel parsing
      const sheetRows = extractRowsBySheet(workbook);
      for (const entry of sheetRows) {
        const detected = detectFormatForSheet(entry.sheetName, entry.rows);
        if (!detected) continue;

        let parsed: ParseResult;
        if (detected.format === "DAY_NUMBER_TABLE") {
          parsed = parseDayNumberTableFormat(detected.rows);
        } else if (detected.format === "WEEK_EXERCITIU") {
          parsed = parseWeekExercitiuFormat(detected.rows);
        } else {
          parsed = parseWeekWorkingSetsFormat(detected.rows);
        }

        if (!parsed.success) {
          return {
            success: false,
            code: "PARSE_FAILED",
            msg: "Could not import workout plan from this Excel file.",
            errors: parsed.errors,
          };
        }

        return {
          success: true,
          data: {
            planName: derivePlanName(pickedAsset.name, detected.sheetName),
            splitDays: parsed.splitDays,
            days: parsed.days,
          },
        };
      }

      return {
        success: false,
        code: "UNSUPPORTED_FORMAT",
        msg: "Excel format not supported for workout import.",
      };
    } else {
      // It's a text file (CSV, TXT, JSON)
      try {
        fileTextForAI = await FileSystem.readAsStringAsync(pickedAsset.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch {
        return {
          success: false,
          code: "READ_FAILED",
          msg: "Could not read the selected text file.",
        };
      }

      const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY;
      if (!apiKey) {
        return {
          success: false,
          code: "PARSE_FAILED",
          msg: "Groq API key is required to parse non-Excel files.",
        };
      }

      return await importWorkoutPlanWithAI(fileTextForAI, fallbackName);
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Could not import workout plan.";
    return {
      success: false,
      code: "READ_FAILED",
      msg: message,
    };
  }
};
