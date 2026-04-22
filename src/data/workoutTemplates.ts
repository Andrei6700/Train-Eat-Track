import { WorkoutTemplate } from "../types";

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: "full-body",
    name: "Full Body",
    description: "3 days per week - Full body workouts",
    daysPerWeek: 3,
    splitDays: ["Luni", "Miercuri", "Vineri"],
    days: [
      {
        day: "Luni",
        isRestDay: false,
        exercises: [
          {
            exerciseName: "Squat cu bara",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Bench press cu bara",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Tracțiuni sau lat pulldown",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Overhead press cu gantere",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Romanian deadlift",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Plank",
            sets: [
              { reps: 45, weight: 0, weightUnit: "kg" },
              { reps: 45, weight: 0, weightUnit: "kg" },
              { reps: 30, weight: 0, weightUnit: "kg" },
            ],
          },
        ],
        notes: "~45 min session",
      },
      {
        day: "Miercuri",
        isRestDay: false,
        exercises: [
          {
            exerciseName: "Deadlift conventional",
            sets: [
              { reps: 6, weight: 0, weightUnit: "kg" },
              { reps: 6, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Dumbbell bench press înclinat",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Barbell row aplecat",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Leg press",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Lateral raises",
            sets: [
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Curl biceps cu bara",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
        ],
        notes: "~45 min session",
      },
      {
        day: "Vineri",
        isRestDay: false,
        exercises: [
          {
            exerciseName: "Goblet squat cu gantera",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Dips sau pushdown triceps",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Cable row sau DB row",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Bulgarian split squat",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Face pulls",
            sets: [
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Calf raise",
            sets: [
              { reps: 15, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
              { reps: 20, weight: 0, weightUnit: "kg" },
            ],
          },
        ],
        notes: "~45 min session",
      },
    ],
  },
  {
    id: "upper-lower",
    name: "Upper/Lower",
    description: "4 days per week - Upper/Lower split",
    daysPerWeek: 4,
    splitDays: ["Luni (Upper)", "Marți (Lower)", "Joi (Upper)", "Vineri (Lower)"],
    days: [
      {
        day: "Luni",
        isRestDay: false,
        exercises: [
          {
            exerciseName: "Bench press",
            sets: [
              { reps: 6, weight: 0, weightUnit: "kg" },
              { reps: 6, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Barbell row",
            sets: [
              { reps: 6, weight: 0, weightUnit: "kg" },
              { reps: 6, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Incline dumbbell press",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Lat pulldown",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Overhead press",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Barbell curl",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
        ],
        notes: "Upper body - ~50 min",
      },
      {
        day: "Marți",
        isRestDay: false,
        exercises: [
          {
            exerciseName: "Back squat",
            sets: [
              { reps: 6, weight: 0, weightUnit: "kg" },
              { reps: 6, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Deadlift",
            sets: [
              { reps: 5, weight: 0, weightUnit: "kg" },
              { reps: 5, weight: 0, weightUnit: "kg" },
              { reps: 5, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Leg press",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Leg curl machine",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Cable crunch",
            sets: [
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
            ],
          },
        ],
        notes: "Lower body - ~45 min",
      },
      {
        day: "Joi",
        isRestDay: false,
        exercises: [
          {
            exerciseName: "Deadlift variation (Sumo or Trap bar)",
            sets: [
              { reps: 6, weight: 0, weightUnit: "kg" },
              { reps: 6, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Incline bench press",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Pendlay row",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Lat pulldown",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Tricep rope pushdown",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Face pulls",
            sets: [
              { reps: 15, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
            ],
          },
        ],
        notes: "Upper body - ~50 min",
      },
      {
        day: "Vineri",
        isRestDay: false,
        exercises: [
          {
            exerciseName: "Front squat atau Goblet Squat",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Leg press",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Hack squat",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Leg curl machine",
            sets: [
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Calf raise machine",
            sets: [
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
              { reps: 20, weight: 0, weightUnit: "kg" },
            ],
          },
        ],
        notes: "Lower body - ~45 min",
      },
    ],
  },
  {
    id: "ppl",
    name: "Push/Pull/Legs",
    description: "6 days per week - Push/Pull/Legs PPL split",
    daysPerWeek: 6,
    splitDays: ["Luni (Push)", "Marți (Pull)", "Miercuri (Legs)", "Joi (Push)", "Vineri (Pull)", "Sâmbătă (Legs)"],
    days: [
      {
        day: "Luni",
        isRestDay: false,
        exercises: [
          {
            exerciseName: "Bench press",
            sets: [
              { reps: 6, weight: 0, weightUnit: "kg" },
              { reps: 6, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Incline dumbbell press",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Overhead press",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Close-grip bench press",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Tricep rope pushdown",
            sets: [
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Dips",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
        ],
        notes: "Push Day - ~60 min",
      },
      {
        day: "Marți",
        isRestDay: false,
        exercises: [
          {
            exerciseName: "Deadlift",
            sets: [
              { reps: 5, weight: 0, weightUnit: "kg" },
              { reps: 5, weight: 0, weightUnit: "kg" },
              { reps: 5, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Barbell row",
            sets: [
              { reps: 6, weight: 0, weightUnit: "kg" },
              { reps: 6, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Lat pulldown",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Chest supported row",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Barbell curl",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Face pulls",
            sets: [
              { reps: 15, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
            ],
          },
        ],
        notes: "Pull Day - ~60 min",
      },
      {
        day: "Miercuri",
        isRestDay: false,
        exercises: [
          {
            exerciseName: "Back squat",
            sets: [
              { reps: 6, weight: 0, weightUnit: "kg" },
              { reps: 6, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Leg press",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Leg curl machine",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Walking lunges",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Calf raise machine",
            sets: [
              { reps: 15, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
              { reps: 20, weight: 0, weightUnit: "kg" },
            ],
          },
        ],
        notes: "Legs Day - ~50 min",
      },
      {
        day: "Joi",
        isRestDay: false,
        exercises: [
          {
            exerciseName: "Incline bench press",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Dumbbell bench press",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Machine shoulder press",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Lateral raises",
            sets: [
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Tricep overhead extension",
            sets: [
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Machine dips",
            sets: [
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
        ],
        notes: "Push Day - ~55 min",
      },
      {
        day: "Vineri",
        isRestDay: false,
        exercises: [
          {
            exerciseName: "Barbell row variation",
            sets: [
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 8, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Lat pulldown machine",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Cable row",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Reverse pec deck",
            sets: [
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Dumbbell curl",
            sets: [
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Machine preacher curl",
            sets: [
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
        ],
        notes: "Pull Day - ~55 min",
      },
      {
        day: "Sâmbătă",
        isRestDay: false,
        exercises: [
          {
            exerciseName: "Leg press",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Hack squat",
            sets: [
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 10, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Leg extension machine",
            sets: [
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Leg curl machine",
            sets: [
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 12, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
            ],
          },
          {
            exerciseName: "Leg press calf raise",
            sets: [
              { reps: 15, weight: 0, weightUnit: "kg" },
              { reps: 15, weight: 0, weightUnit: "kg" },
              { reps: 20, weight: 0, weightUnit: "kg" },
            ],
          },
        ],
        notes: "Legs Day - ~45 min",
      },
    ],
  },
];

export const getTemplateById = (id: string): WorkoutTemplate | undefined => {
  return WORKOUT_TEMPLATES.find((template) => template.id === id);
};
