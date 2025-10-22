import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import { addWorkout } from "@/src/services/workoutService";
import { WorkoutExercise, WorkoutSet } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DAYS_FULL = ["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"];

type LapTime = {
  lapNumber: number;
  time: number;
  timestamp: Date;
};

const AddWorkout = () => {
  const { user } = useAuth();
  const router = useRouter();
  const { workoutPlan } = useWorkoutPlan();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [startTime] = useState(new Date());
  
  // CRONOMETRU
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [laps, setLaps] = useState<LapTime[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [exercises, setExercises] = useState<WorkoutExercise[]>([
    {
      exerciseName: "",
      sets: [{ reps: 0, weight: 0, weightUnit: "kg" }],
    },
  ]);

  // Prefill din plan
  useEffect(() => {
    if (!workoutPlan) return;

    const today = new Date();
    const dayName = DAYS_FULL[today.getDay() === 0 ? 6 : today.getDay() - 1];
    const planDay = workoutPlan.days?.find((d) => d.day === dayName);

    if (planDay && planDay.exercises && planDay.exercises.length > 0) {
      const cloned = planDay.exercises.map((ex) => ({
        exerciseName: ex.exerciseName || "",
        sets: ex.sets?.map((s) => ({
          reps: typeof s.reps === "number" ? s.reps : parseInt(s.reps as any) || 0,
          weight: typeof s.weight === "number" ? s.weight : parseFloat(s.weight as any) || 0,
          weightUnit: s.weightUnit || "kg",
        })) || [{ reps: 0, weight: 0, weightUnit: "kg" }],
      })) as WorkoutExercise[];

      setExercises(cloned);
    }
  }, [workoutPlan]);

  // CRONOMETRU LOGIC
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const formatLapTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const handleLap = () => {
    const lapNumber = laps.length + 1;
    const newLap: LapTime = {
      lapNumber,
      time: elapsedTime,
      timestamp: new Date(),
    };
    
    setLaps([...laps, newLap]);
  };

  const clearLaps = () => {
    setLaps([]);
  };

  const addExercise = () => {
    setExercises([
      ...exercises,
      {
        exerciseName: "",
        sets: [{ reps: 0, weight: 0, weightUnit: "kg" }],
      },
    ]);
  };

  const removeExercise = (index: number) => {
    if (exercises.length === 1) {
      Alert.alert("Error", "You need at least one exercise");
      return;
    }
    const newExercises = exercises.filter((_, i) => i !== index);
    setExercises(newExercises);
  };

  const updateExerciseName = (index: number, name: string) => {
    const newExercises = [...exercises];
    newExercises[index].exerciseName = name;
    setExercises(newExercises);
  };

  const addSet = (exerciseIndex: number) => {
    const newExercises = [...exercises];
    const lastSet = newExercises[exerciseIndex].sets[newExercises[exerciseIndex].sets.length - 1];
    newExercises[exerciseIndex].sets.push({
      reps: lastSet?.reps || 0,
      weight: lastSet?.weight || 0,
      weightUnit: lastSet?.weightUnit || "kg",
    });
    setExercises(newExercises);
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    if (exercises[exerciseIndex].sets.length === 1) {
      Alert.alert("Error", "Each exercise needs at least one set");
      return;
    }
    const newExercises = [...exercises];
    newExercises[exerciseIndex].sets = newExercises[exerciseIndex].sets.filter(
      (_, i) => i !== setIndex
    );
    setExercises(newExercises);
  };

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: keyof WorkoutSet,
    value: any
  ) => {
    const newExercises = [...exercises];
    if (field === "reps") {
      newExercises[exerciseIndex].sets[setIndex][field] = parseInt(value as any) || 0;
    } else if (field === "weight") {
      newExercises[exerciseIndex].sets[setIndex][field] = parseFloat(value as any) || 0;
    } else {
      newExercises[exerciseIndex].sets[setIndex][field] = value;
    }
    setExercises(newExercises);
  };

  const toggleWeightUnit = (exerciseIndex: number, setIndex: number) => {
    const newExercises = [...exercises];
    const currentUnit = newExercises[exerciseIndex].sets[setIndex].weightUnit;
    newExercises[exerciseIndex].sets[setIndex].weightUnit =
      currentUnit === "kg" ? "lbs" : "kg";
    setExercises(newExercises);
  };

  const handleSaveWorkout = async () => {
    const hasEmptyExerciseName = exercises.some((ex) => !ex.exerciseName.trim());
    if (hasEmptyExerciseName) {
      Alert.alert("Error", "Please fill in all exercise names");
      return;
    }

    const hasInvalidSets = exercises.some((ex) =>
      ex.sets.some((set) => set.reps <= 0 || set.weight < 0)
    );
    if (hasInvalidSets) {
      Alert.alert("Error", "Please fill in valid reps and weight for all sets");
      return;
    }

    if (!user?.uid) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    const duration = elapsedTime;

    const workoutData = {
      userID: user.uid,
      date: new Date(),
      duration,
      exercises,
    };

    setLoading(true);
    try {
      console.log("[AddWorkout] workoutData before addWorkout:", JSON.stringify(workoutData));
      const result = await addWorkout(workoutData as any);
      console.log("[AddWorkout] addWorkout result:", result);
      setLoading(false);

      if (result.success) {
        Alert.alert("Success", "Workout saved successfully!", [
          {
            text: "OK",
            onPress: () => {
              router.push({
                pathname: "/(tabs)/history",
                params: { refresh: "true" },
              });
            },
          },
        ]);
      } else {
        Alert.alert("Error", result.msg || "Could not save workout");
      }
    } catch (err: any) {
      setLoading(false);
      console.error("Error saving workout:", err);
      Alert.alert("Error", err?.message || "Could not save workout");
    }
  };

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title="Add Workout"
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._15 }}
        />

        {/* CRONOMETRU */}
        <View style={styles.timerContainer}>
          <View>
            <Typo size={32} fontWeight="700" color={colors.primary}>
              {formatTime(elapsedTime)}
            </Typo>
            {laps.length > 0 && (
              <Typo size={14} color={colors.neutral400} style={{ marginTop: spacingY._5 }}>
                Last lap: {formatLapTime(
                  laps.length > 1 
                    ? laps[laps.length - 1].time - laps[laps.length - 2].time
                    : laps[0].time
                )}
              </Typo>
            )}
          </View>
          <View style={styles.timerButtons}>
            <TouchableOpacity onPress={toggleTimer} style={styles.timerButton}>
              {isRunning ? (
                <Icons.PauseIcon size={20} color={colors.white} weight="fill" />
              ) : (
                <Icons.PlayIcon size={20} color={colors.white} weight="fill" />
              )}
              <Typo size={14} fontWeight="600" color={colors.white}>
                {isRunning ? "Pause" : "Resume"}
              </Typo>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLap} style={styles.lapButton}>
              <Icons.ClockCountdownIcon size={20} color={colors.primary} />
              <Typo size={14} fontWeight="600" color={colors.primary}>
                Lap
              </Typo>
            </TouchableOpacity>
          </View>
        </View>

        {/* Laps List */}
        {laps.length > 0 && (
          <View style={styles.lapsContainer}>
            <View style={styles.lapsHeader}>
              <Typo size={14} fontWeight="600" color={colors.neutral300}>
                Rest Times
              </Typo>
              <TouchableOpacity onPress={clearLaps}>
                <Typo size={13} color={colors.primary}>
                  Clear
                </Typo>
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.lapsList}
              showsVerticalScrollIndicator={false}
            >
              {[...laps].reverse().map((lap, index) => {
                const actualIndex = laps.length - 1 - index;
                const lapDuration = actualIndex > 0 
                  ? lap.time - laps[actualIndex - 1].time 
                  : lap.time;
                
                return (
                  <View key={lap.lapNumber} style={styles.lapItem}>
                    <Typo size={14} color={colors.neutral400}>
                      Lap {lap.lapNumber}
                    </Typo>
                    <Typo size={14} fontWeight="600" color={colors.white}>
                      {formatLapTime(lapDuration)}
                    </Typo>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: verticalScale(220) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Exercises */}
          {exercises.map((exercise, exerciseIndex) => (
            <View key={exerciseIndex} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <Typo size={18} fontWeight="600">
                  Exercise {exerciseIndex + 1}
                </Typo>
                {exercises.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeExercise(exerciseIndex)}
                    style={styles.removeButton}
                  >
                    <Icons.TrashIcon size={20} color={colors.rose} />
                  </TouchableOpacity>
                )}
              </View>

              <Input
                placeholder="Exercise name (e.g., Bench Press)"
                value={exercise.exerciseName}
                onChangeText={(text) => updateExerciseName(exerciseIndex, text)}
                containerStyle={{ marginBottom: spacingY._15 }}
              />

              <Typo size={15} fontWeight="500" style={{ marginBottom: spacingY._10 }}>
                Sets
              </Typo>

              {exercise.sets.map((set, setIndex) => (
                <View key={setIndex} style={styles.setRow}>
                  <View style={styles.setNumber}>
                    <Typo size={14} color={colors.neutral400}>
                      {setIndex + 1}
                    </Typo>
                  </View>

                  <View style={styles.setInput}>
                    <Input
                      placeholder="Reps"
                      keyboardType="numeric"
                      value={set.reps > 0 ? set.reps.toString() : ""}
                      onChangeText={(text) =>
                        updateSet(exerciseIndex, setIndex, "reps", text)
                      }
                      containerStyle={styles.smallInput}
                    />
                  </View>

                  <View style={styles.setInput}>
                    <Input
                      placeholder="Weight"
                      keyboardType="numeric"
                      value={set.weight > 0 ? set.weight.toString() : ""}
                      onChangeText={(text) =>
                        updateSet(exerciseIndex, setIndex, "weight", text)
                      }
                      containerStyle={styles.smallInput}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={() => toggleWeightUnit(exerciseIndex, setIndex)}
                    style={styles.unitButton}
                  >
                    <Typo size={14} fontWeight="600" color={colors.primary}>
                      {set.weightUnit}
                    </Typo>
                  </TouchableOpacity>

                  {exercise.sets.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeSet(exerciseIndex, setIndex)}
                      style={styles.removeSetButton}
                    >
                      <Icons.XIcon size={18} color={colors.rose} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity
                onPress={() => addSet(exerciseIndex)}
                style={styles.addSetButton}
              >
                <Icons.PlusIcon size={18} color={colors.primary} />
                <Typo size={14} fontWeight="500" color={colors.primary}>
                  Add Set
                </Typo>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity onPress={addExercise} style={styles.addExerciseButton}>
            <Icons.PlusCircleIcon size={24} color={colors.primary} weight="fill" />
            <Typo size={16} fontWeight="600" color={colors.primary}>
              Add Exercise
            </Typo>
          </TouchableOpacity>
        </ScrollView>

        {/* Footer - Save Button */}
        <View style={[styles.footerSticky, { bottom: insets.bottom + 12 }]}>
          <Button onPress={handleSaveWorkout} loading={loading} style={{ flex: 1 }}>
            <Typo color={colors.black} fontWeight="700" size={18}>
              Finish Workout
            </Typo>
          </Button>
        </View>
      </View>
    </ModalWrapper>
  );
};

export default AddWorkout;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  timerContainer: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  timerButtons: {
    flexDirection: "row",
    gap: spacingX._7,
  },
  timerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
    backgroundColor: colors.neutral700,
    paddingHorizontal: spacingX._15,
    paddingVertical: verticalScale(8),
    borderRadius: radius._12,
  },
  lapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
    backgroundColor: colors.neutral700,
    paddingHorizontal: spacingX._15,
    paddingVertical: verticalScale(8),
    borderRadius: radius._12,
  },
  lapsContainer: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    padding: spacingX._15,
    marginBottom: spacingY._15,
    maxHeight: verticalScale(150),
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  lapsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._10,
  },
  lapsList: {
    maxHeight: verticalScale(100),
  },
  lapItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: verticalScale(6),
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral700,
  },
  scrollContent: {
    paddingBottom: verticalScale(20),
    gap: spacingY._15,
  },
  exerciseCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._15,
  },
  removeButton: {
    padding: spacingX._7,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    marginBottom: spacingY._10,
  },
  setNumber: {
    width: verticalScale(30),
    height: verticalScale(30),
    borderRadius: 100,
    backgroundColor: colors.neutral700,
    alignItems: "center",
    justifyContent: "center",
  },
  setInput: {
    flex: 1,
  },
  smallInput: {
    height: verticalScale(45),
  },
  unitButton: {
    backgroundColor: colors.neutral700,
    paddingHorizontal: spacingX._12,
    paddingVertical: verticalScale(10),
    borderRadius: radius._10,
    minWidth: verticalScale(50),
    alignItems: "center",
  },
  removeSetButton: {
    padding: spacingX._5,
  },
  addSetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._7,
    paddingVertical: spacingY._10,
    marginTop: spacingY._10,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius._12,
    borderStyle: "dashed",
  },
  addExerciseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._10,
    paddingVertical: spacingY._15,
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
  },
  footerSticky: {
    position: "absolute",
    left: spacingX._20,
    right: spacingX._20,
    zIndex: 30,
  },
});