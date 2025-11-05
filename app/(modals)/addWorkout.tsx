import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import { addWorkout, checkWorkoutExistsToday, getLastWeekWorkout } from "@/src/services/workoutService";
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

const AddWorkout = () => {
  const { user } = useAuth();
  const router = useRouter();
  const { workoutPlan } = useWorkoutPlan();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  
  // Timer states
  const [currentTime, setCurrentTime] = useState(0); // Timpul curent (resetabil cu LAP)
  const [totalTime, setTotalTime] = useState(0); // Timpul TOTAL acumulat
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [exercises, setExercises] = useState<WorkoutExercise[]>([
    {
      exerciseName: "",
      sets: [{ reps: 0, weight: 0, weightUnit: "kg" }],
    },
  ]);

  // Prefill din plan + date din săptămâna trecută
  useEffect(() => {
    loadWorkoutData();
  }, [workoutPlan, user?.uid]);

  const loadWorkoutData = async () => {
    if (!workoutPlan || !user?.uid) return;

    const today = new Date();
    const dayName = DAYS_FULL[today.getDay() === 0 ? 6 : today.getDay() - 1];
    const planDay = workoutPlan.days?.find((d) => d.day === dayName);

    if (!planDay || !planDay.exercises || planDay.exercises.length === 0) {
      return;
    }

    const lastWeekResult = await getLastWeekWorkout(user.uid, dayName);
    
    if (lastWeekResult.success && lastWeekResult.data) {
      const mergedExercises = planDay.exercises.map((planEx) => {
        const lastWeekEx = lastWeekResult.data.exercises?.find(
          (ex: WorkoutExercise) => ex.exerciseName.toLowerCase() === planEx.exerciseName.toLowerCase()
        );

        if (lastWeekEx) {
          return {
            exerciseName: planEx.exerciseName,
            sets: lastWeekEx.sets.map((s: WorkoutSet) => ({
              reps: s.reps || 0,
              weight: s.weight || 0,
              weightUnit: s.weightUnit || "kg",
            })),
          };
        }

        return {
          exerciseName: planEx.exerciseName,
          sets: planEx.sets?.map((s) => ({
            reps: typeof s.reps === "number" ? s.reps : parseInt(s.reps as any) || 0,
            weight: typeof s.weight === "number" ? s.weight : parseFloat(s.weight as any) || 0,
            weightUnit: s.weightUnit || "kg",
          })) || [{ reps: 0, weight: 0, weightUnit: "kg" }],
        };
      });

      setExercises(mergedExercises as WorkoutExercise[]);
    } else {
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
  };

  // Timer automat
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurrentTime((prev) => prev + 1);
      setTotalTime((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // ✅ Functia LAP - resetează currentTime
  const handleLap = () => {
    setCurrentTime(0);
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

    const existsCheck = await checkWorkoutExistsToday(user.uid);
    if (!existsCheck.success && existsCheck.data?.exists) {
      Alert.alert(
        "Already Logged", 
        "You already have a workout logged for today. You can only log one workout per day.",
        [{ text: "OK" }]
      );
      return;
    }

    // ✅ Salvează totalTime (timpul TOTAL acumulat)
    const workoutData = {
      userID: user.uid,
      date: new Date(),
      duration: totalTime,
      exercises,
    };

    setLoading(true);
    try {
      const result = await addWorkout(workoutData as any);
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

        {/* Timer Container */}
        <View style={styles.timerContainer}>
          {/* Current Time (resetabil cu LAP) */}
          <View style={styles.currentTimeSection}>
            <Typo size={11} color={colors.neutral400} style={{ marginBottom: spacingY._5 }}>
              REST TIME
            </Typo>
            <Typo size={40} fontWeight="700" color={colors.primary}>
              {formatTime(currentTime)}
            </Typo>
          </View>

          {/* LAP Button */}
          <TouchableOpacity onPress={handleLap} style={styles.lapButton}>
            <Icons.ArrowCounterClockwiseIcon size={20} color={colors.white} weight="bold" />
            <Typo size={14} fontWeight="600" color={colors.white}>
              Lap 
            </Typo>
          </TouchableOpacity>

          {/* Total Time (acumulat) */}
          <View style={styles.totalTimeSection}>
            <Typo size={11} color={colors.neutral400}>
              TOTAL TIME
            </Typo>
            <Typo size={16} fontWeight="600" color={colors.white}>
              {formatTime(totalTime)}
            </Typo>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: verticalScale(100) }]}
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
    marginBottom: spacingY._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
    alignItems: "center",
    gap: spacingY._12,
  },
  currentTimeSection: {
    alignItems: "center",
  },
  lapButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._7,
    backgroundColor: colors.neutral700,
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._20,
    borderRadius: radius._12,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  totalTimeSection: {
    alignItems: "center",
    paddingTop: spacingY._10,
    borderTopWidth: 1,
    borderTopColor: colors.neutral700,
    width: "100%",
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