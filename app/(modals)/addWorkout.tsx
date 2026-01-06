import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import {
  addWorkout,
  checkWorkoutExistsToday,
  getLastWeekWorkout,
} from "@/src/services/workoutService";
import { WorkoutExercise, WorkoutSet } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DAYS_FULL = [
  "Luni",
  "Marti",
  "Miercuri",
  "Joi",
  "Vineri",
  "Sambata",
  "Duminica",
];

const AddWorkout = () => {
  const { user } = useAuth();
  const router = useRouter();
  const { workoutPlan } = useWorkoutPlan();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);

  // Timer states
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // keep history exercises to show last week's data
  const [historyExercises, setHistoryExercises] = useState<
    Record<string, WorkoutExercise>
  >({});

  const [exercises, setExercises] = useState<WorkoutExercise[]>([
    {
      exerciseName: "",
      sets: [{ reps: 0, weight: 0, weightUnit: "kg" }],
    },
  ]);

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

    // Load last week's data
    const lastWeekResult = await getLastWeekWorkout(user.uid, dayName);
    let newHistoryExercises: Record<string, WorkoutExercise> = {};

    if (lastWeekResult.success && lastWeekResult.data) {
      // keep history exercises to show last week's data
      lastWeekResult.data.exercises?.forEach((ex: WorkoutExercise) => {
        newHistoryExercises[ex.exerciseName.toLowerCase()] = ex;
      });

      setHistoryExercises(newHistoryExercises);

      // Prefill with last week's values
      const mergedExercises = planDay.exercises.map((planEx) => {
        const lastWeekEx = lastWeekResult.data.exercises?.find(
          (ex: WorkoutExercise) =>
            ex.exerciseName.toLowerCase() === planEx.exerciseName.toLowerCase()
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

        // If not in history, use the plan
        return {
          exerciseName: planEx.exerciseName,
          sets:
            planEx.sets?.map((s) => ({
              reps:
                typeof s.reps === "number"
                  ? s.reps
                  : parseInt(s.reps as any) || 0,
              weight:
                typeof s.weight === "number"
                  ? s.weight
                  : parseFloat(s.weight as any) || 0,
              weightUnit: s.weightUnit || "kg",
            })) || [{ reps: 0, weight: 0, weightUnit: "kg" }],
        };
      });

      setExercises(mergedExercises as WorkoutExercise[]);
    } else {
      // No history, load only the plan
      const cloned = planDay.exercises.map((ex) => ({
        exerciseName: ex.exerciseName || "",
        sets:
          ex.sets?.map((s) => ({
            reps:
              typeof s.reps === "number"
                ? s.reps
                : parseInt(s.reps as any) || 0,
            weight:
              typeof s.weight === "number"
                ? s.weight
                : parseFloat(s.weight as any) || 0,
            weightUnit: s.weightUnit || "kg",
          })) || [{ reps: 0, weight: 0, weightUnit: "kg" }],
      })) as WorkoutExercise[];
      setExercises(cloned);
      setHistoryExercises({});
    }
  };

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

  const handleLap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentTime(0);
  };

  const addExercise = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExercises([
      ...exercises,
      {
        exerciseName: "",
        sets: [{ reps: 0, weight: 0, weightUnit: "kg" }],
      },
    ]);
  };

  const removeExercise = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newExercises = [...exercises];
    const lastSet =
      newExercises[exerciseIndex].sets[
        newExercises[exerciseIndex].sets.length - 1
      ];
    newExercises[exerciseIndex].sets.push({
      reps: lastSet?.reps || 0,
      weight: lastSet?.weight || 0,
      weightUnit: lastSet?.weightUnit || "kg",
    });
    setExercises(newExercises);
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      newExercises[exerciseIndex].sets[setIndex][field] =
        parseInt(value as any) || 0;
    } else if (field === "weight") {
      newExercises[exerciseIndex].sets[setIndex][field] =
        parseFloat(value as any) || 0;
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const hasEmptyExerciseName = exercises.some(
      (ex) => !ex.exerciseName.trim()
    );
    if (hasEmptyExerciseName) {
      Alert.alert("Error", "Please fill in all exercise names");
      return;
    }

    const hasInvalidSets = exercises.some((ex) =>
      ex.sets.some((set) => set.reps <= 0 || set.weight < 0)
    );
    if (hasInvalidSets) {
      Alert.alert(
        "Error",
        "Please fill in valid reps and weight for all sets"
      );
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
        "You already have a workout logged for today.",
        [{ text: "OK" }]
      );
      return;
    }

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
        // Check if saved offline
        const isOffline = result.data?.offline;

        Alert.alert(
          isOffline ? "Saved Offline" : "Success",
          isOffline
            ? "Antrenamentul a fost salvat local și va fi sincronizat când vei avea conexiune la internet."
            : "Workout saved successfully!",
          [
            {
              text: "OK",
              onPress: () => {
                router.push({
                  pathname: "/(tabs)/history",
                  params: { refresh: "true" },
                });
              },
            },
          ]
        );
      } else {
        Alert.alert("Error", result.msg || "Could not save workout");
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert("Error", err?.message || "Could not save workout");
    }
  };

  // Helper function to get the historical set
  const getHistoricalSet = (
    exerciseName: string,
    setIndex: number
  ): WorkoutSet | null => {
    const histEx = historyExercises[exerciseName.toLowerCase()];
    if (histEx && histEx.sets && histEx.sets[setIndex]) {
      return histEx.sets[setIndex];
    }
    return null;
  };

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title="Log Workout"
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._15 }}
        />

        {/* Timer Container */}
        <View style={styles.timerContainer}>
          <View style={styles.currentTimeSection}>
            <Typo
              size={12}
              color={colors.neutral400}
              style={{ marginBottom: spacingY._5 }}
            >
              REST TIMER
            </Typo>
            <Typo size={36} fontWeight="700" color={colors.primary}>
              {formatTime(currentTime)}
            </Typo>
          </View>
          <TouchableOpacity onPress={handleLap} style={styles.lapButton}>
            <Icons.ArrowCounterClockwise
              size={18}
              color={colors.black}
              weight="bold"
            />
            <Typo size={14} fontWeight="700" color={colors.black}>
              RESET REST
            </Typo>
          </TouchableOpacity>
          <View style={styles.totalTimeSection}>
            <Typo size={12} color={colors.neutral400}>
              TOTAL TIME:{" "}
            </Typo>
            <Typo size={14} fontWeight="600" color={colors.white}>
              {formatTime(totalTime)}
            </Typo>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: verticalScale(100) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {exercises.map((exercise, exerciseIndex) => (
            <View key={exerciseIndex} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <View style={{ flex: 1 }}>
                  <Typo
                    size={16}
                    fontWeight="600"
                    color={colors.neutral300}
                    style={{ marginBottom: 4 }}
                  >
                    Exercise {exerciseIndex + 1}
                  </Typo>
                  <Input
                    placeholder="Exercise Name"
                    value={exercise.exerciseName}
                    onChangeText={(text) =>
                      updateExerciseName(exerciseIndex, text)
                    }
                    containerStyle={styles.exerciseNameInput}
                  />

                  {/* Show full history */}
                  {exercise.exerciseName &&
                    historyExercises[exercise.exerciseName.toLowerCase()] && (
                      <View style={styles.historyContainer}>
                        <Icons.ClockCounterClockwise
                          size={14}
                          color={colors.primary}
                        />
                        <Typo
                          size={12}
                          color={colors.primary}
                          style={{ flex: 1 }}
                        >
                          Last week:{" "}
                          {historyExercises[exercise.exerciseName.toLowerCase()]
                            .sets.map((s) => `${s.weight}${s.weightUnit} × ${s.reps}`)
                            .join(", ")}
                        </Typo>
                      </View>
                    )}
                </View>

                {exercises.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeExercise(exerciseIndex)}
                    style={styles.removeButton}
                  >
                    <Icons.Trash size={20} color={colors.rose} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Header Row for Sets */}
              <View style={styles.setHeaderRow}>
                <Typo
                  size={12}
                  color={colors.neutral400}
                  style={{ width: 30, textAlign: "center" }}
                >
                  Set
                </Typo>
                <Typo
                  size={12}
                  color={colors.neutral400}
                  style={{ flex: 1, textAlign: "center" }}
                >
                  Reps
                </Typo>
                <Typo
                  size={12}
                  color={colors.neutral400}
                  style={{ flex: 1, textAlign: "center" }}
                >
                  Weight
                </Typo>
                <View style={{ width: 30 }} />
              </View>

              {exercise.sets.map((set, setIndex) => {
                const historicalSet = getHistoricalSet(
                  exercise.exerciseName,
                  setIndex
                );

                return (
                  <View key={setIndex} style={styles.setRow}>
                    <View style={styles.setNumber}>
                      <Typo size={14} fontWeight="600" color={colors.neutral400}>
                        {setIndex + 1}
                      </Typo>
                    </View>

                    {/* Input Reps with historical placeholder */}
                    <View style={styles.setInput}>
                      <Input
                        placeholder={
                          historicalSet ? `${historicalSet.reps}` : "0"
                        }
                        keyboardType="numeric"
                        value={set.reps > 0 ? set.reps.toString() : ""}
                        onChangeText={(text) =>
                          updateSet(exerciseIndex, setIndex, "reps", text)
                        }
                        containerStyle={styles.smallInput}
                        inputStyle={{ textAlign: "center" }}
                      />
                    </View>

                    {/* Input Weight with historical placeholder */}
                    <View style={styles.setInput}>
                      <Input
                        placeholder={
                          historicalSet ? `${historicalSet.weight}` : "0"
                        }
                        keyboardType="numeric"
                        value={set.weight > 0 ? set.weight.toString() : ""}
                        onChangeText={(text) =>
                          updateSet(exerciseIndex, setIndex, "weight", text)
                        }
                        containerStyle={styles.smallInput}
                        inputStyle={{ textAlign: "center" }}
                      />
                    </View>

                    <TouchableOpacity
                      onPress={() => toggleWeightUnit(exerciseIndex, setIndex)}
                      style={styles.unitButton}
                    >
                      <Typo
                        size={12}
                        fontWeight="600"
                        color={colors.neutral400}
                      >
                        {set.weightUnit}
                      </Typo>
                    </TouchableOpacity>

                    {exercise.sets.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeSet(exerciseIndex, setIndex)}
                        style={styles.removeSetButton}
                      >
                        <Icons.X size={16} color={colors.neutral500} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              <TouchableOpacity
                onPress={() => addSet(exerciseIndex)}
                style={styles.addSetButton}
              >
                <Icons.Plus size={16} color={colors.primary} />
                <Typo size={14} fontWeight="600" color={colors.primary}>
                  Add Set
                </Typo>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            onPress={addExercise}
            style={styles.addExerciseButton}
          >
            <Icons.PlusCircle size={24} color={colors.white} weight="fill" />
            <Typo size={16} fontWeight="600" color={colors.white}>
              Add Exercise
            </Typo>
          </TouchableOpacity>
        </ScrollView>

        <View style={[styles.footerSticky, { bottom: insets.bottom + 12 }]}>
          <Button
            onPress={handleSaveWorkout}
            loading={loading}
            style={styles.finishButton}
          >
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
    padding: spacingX._15,
    marginBottom: spacingY._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  currentTimeSection: {
    alignItems: "center",
  },
  lapButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._7,
    backgroundColor: colors.primary,
    paddingVertical: spacingY._7,
    paddingHorizontal: spacingX._20,
    borderRadius: radius._12,
    marginVertical: spacingY._10,
  },
  totalTimeSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  scrollContent: {
    paddingBottom: verticalScale(20),
    gap: spacingY._15,
  },
  exerciseCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacingY._15,
  },
  exerciseNameInput: {
    backgroundColor: colors.neutral900,
    height: verticalScale(40),
    borderRadius: radius._10,
    borderWidth: 0,
  },
  historyContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    backgroundColor: "rgba(163, 230, 53, 0.1)",
    padding: 6,
    borderRadius: radius._6,
  },
  removeButton: {
    padding: spacingX._7,
    backgroundColor: colors.neutral900,
    borderRadius: radius._10,
    marginLeft: 10,
  },
  setHeaderRow: {
    flexDirection: "row",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    marginBottom: spacingY._10,
  },
  setNumber: {
    width: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  setInput: {
    flex: 1,
  },
  smallInput: {
    height: verticalScale(40),
    backgroundColor: colors.neutral900,
    borderWidth: 0,
  },
  unitButton: {
    paddingHorizontal: 4,
  },
  removeSetButton: {
    padding: 5,
  },
  addSetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._7,
    paddingVertical: spacingY._10,
    marginTop: spacingY._5,
    backgroundColor: colors.neutral900,
    borderRadius: radius._12,
  },
  addExerciseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._10,
    paddingVertical: spacingY._15,
    backgroundColor: colors.neutral700,
    borderRadius: radius._17,
    marginTop: spacingY._10,
  },
  footerSticky: {
    position: "absolute",
    left: spacingX._20,
    right: spacingX._20,
    zIndex: 30,
  },
  finishButton: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
});