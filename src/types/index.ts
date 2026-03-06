import { Icon } from "phosphor-react-native";
import React, { ReactNode } from "react";
import {
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  TouchableOpacityProps,
  ViewStyle
} from "react-native";

export type ScreenWrapperProps = {
  style?: ViewStyle;
  children: React.ReactNode;
};
export type ModalWrapperProps = {
  style?: ViewStyle;
  children: React.ReactNode;
  bg?: string;
};
export type accountOptionType = {
  title: string;
  icon: React.ReactNode;
  bgColor: string;
  routeName?: any;
};

export type TypoProps = {
  size?: number;
  color?: string;
  fontWeight?: TextStyle["fontWeight"];
  children: any | null;
  style?: TextStyle;
  textProps?: TextProps;
};

export type IconComponent = React.ComponentType<{
  height?: number;
  width?: number;
  strokeWidth?: number;
  color?: string;
  fill?: string;
}>;

export type IconProps = {
  name: string;
  color?: string;
  size?: number;
  strokeWidth?: number;
  fill?: string;
};

export type HeaderProps = {
  title?: string;
  style?: ViewStyle;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export type BackButtonProps = {
  style?: ViewStyle;
  iconSize?: number;
};

export type CategoryType = {
  label: string;
  value: string;
  icon: Icon;
  bgColor: string;
};
export type ExpenseCategoriesType = {
  [key: string]: CategoryType;
};

export interface InputProps extends TextInputProps {
  icon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  inputRef?: React.RefObject<TextInput>;
}

export interface CustomButtonProps extends TouchableOpacityProps {
  style?: ViewStyle;
  onPress?: () => void;
  loading?: boolean;
  children: React.ReactNode;
}

export type ImageUploadProps = {
  file?: any;
  onSelect: (file: any) => void;
  onClear: () => void;
  containerStyle?: ViewStyle;
  imageStyle?: ViewStyle;
  placeholder?: string;
};

export type UserType = {
  uid?: string;
  email?: string | null;
  name: string | null;
  image?: any;
} | null;

export type UserDataType = {
  name: string;
  image?: any;
};

export type AuthContextType = {
  user: UserType;
  setUser: Function;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; msg?: string }>;
  register: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ success: boolean; msg?: string }>;
  updateUserData: (userId: string) => Promise<void>;
};

export type ResponseType = {
  success: boolean;
  data?: any;
  msg?: string;
};

export type WorkoutSet = {
  reps: number;
  weight: number;
  weightUnit: "kg" | "lbs";
};

export type WorkoutExercise = {
  exerciseName: string; 
  sets: WorkoutSet[];
};

export type WorkoutHistory = {
  id?: string;
  userID: string;
  date: Date | string;
  duration: number;
  exercises: WorkoutExercise[];
  isRestDay?: boolean;
};

export type WorkoutHistoryListProps = {
  workouts: WorkoutHistory[];
  loading?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export type DayWorkout = {
  day: string; 
  isRestDay: boolean;
  exercises: WorkoutExercise[];
  notes?: string;
};

export type WorkoutPlan = {
  id?: string;
  userID: string;
  planName: string;
  splitDays?: number; // Cycle length: 2, 4, 7, 9, 14, etc. Default: 7
  days: DayWorkout[];
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type Food = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string; 
};

export type Meal = {
  mealName: string; 
  foods: Food[];
};

export type DailyNutrition = {
  id?: string;
  userID: string;
  date: Date | string;
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  meals: Meal[];
};

export type WaterIntake = {
  amount: number;
  timestamp: Date;
};

export type DailyWater = {
  id?: string;
  userID: string;
  date: Date | string;
  goal: number;
  intakes: WaterIntake[];
  total: number;
};
