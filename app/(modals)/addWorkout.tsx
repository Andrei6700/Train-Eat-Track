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
  getUserWorkouts,
} from "@/src/services/workoutService";
import { WorkoutExercise, WorkoutHistory, WorkoutSet } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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

  // Keep history of exercises to show previous workout data
  const [historyExercises, setHistoryExercises] = useState<
    Record<string, WorkoutExercise>
  >({});

  const [exercises, setExercises] = useState<WorkoutExercise[]>([
    {
      exerciseName: "",
      sets: [{ reps: 0, weight: 0, weightUnit: "kg" }],
    },
  ]);

  /**
   * Calculate which day index in the split cycle today corresponds to
   * This matches the logic in workout.tsx
   */
  const getTodayDayIndex = (): number => {
    if (!workoutPlan || !workoutPlan.splitDays) {
      console.log('[addWorkout] No workout plan or splitDays');
      return 0;
    }

    // Handle both Firestore Timestamp and Date objects
    let planCreatedDate: Date;
    if (workoutPlan.createdAt && typeof workoutPlan.createdAt === 'object' && 'toDate' in workoutPlan.createdAt) {
      // Firestore Timestamp
      planCreatedDate = (workoutPlan.createdAt as any).toDate();
    } else {
      // Regular Date or string
      planCreatedDate = new Date(workoutPlan.createdAt);
    }
    planCreatedDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysDifference = Math.floor(
      (today.getTime() - planCreatedDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    console.log('[addWorkout] Plan created:', planCreatedDate.toISOString());
    console.log('[addWorkout] Today:', today.toISOString());
    console.log('[addWorkout] Days difference:', daysDifference);
    console.log('[addWorkout] Split days:', workoutPlan.splitDays);
    console.log('[addWorkout] Day index:', daysDifference % workoutPlan.splitDays);

    return daysDifference % workoutPlan.splitDays;
  };

  /**
   * Get the day name for today based on split cycle
   */
  const getTodayDayName = (): string => {
    const dayIndex = getTodayDayIndex();
    return `Day ${dayIndex + 1}`;
  };

  /**
   * Find the most recent workout that contains a specific exercise
   * Used to prefill weights and reps from previous sessions
   */
  const findMostRecentExercise = (
    exerciseName: string,
    history: WorkoutHistory[]
  ): WorkoutExercise | null => {
    if (!history || history.length === 0) return null;

    const normalizedName = exerciseName.toLowerCase().trim();

    // Sort history by date descending (most recent first)
    const sortedHistory = [...history].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Find the first workout that contains this exercise
    for (const workout of sortedHistory) {
      const exercise = workout.exercises?.find(
        (ex) => ex.exerciseName.toLowerCase().trim() === normalizedName
      );
      if (exercise) {
        return exercise;
      }
    }

    return null;
  };

  useEffect(() => {
    loadWorkoutData();
  }, [workoutPlan, user?.uid]);

  /**
   * Load workout data with proper split days support and fallback logic
   * 
   * Priority 1: Load exercises from workout plan for today's split day
   * Priority 2: For each exercise in plan, prefill with historical data
   * Priority 3: If plan has no exercises, load the most recent complete workout
   */
  const loadWorkoutData = async () => {
    if (!workoutPlan || !user?.uid) return;

    const today = new Date();
    
    // Get today's day name based on split cycle
    const dayName = getTodayDayName();
    
    console.log('[addWorkout] Loading workout for:', dayName);
    console.log('[addWorkout] Available days in plan:', workoutPlan.days?.map(d => d.day));
    
    // Find the workout plan for today
    const planDay = workoutPlan.days?.find((d) => d.day === dayName);

    if (!planDay) {
      console.log('[addWorkout] No plan found for', dayName);
      return;
    }

    console.log('[addWorkout] Plan day found:', planDay.day, 'Exercises:', planDay.exercises?.length || 0);

    // Load workout history for prefilling
    let workoutHistory: WorkoutHistory[] = [];
    try {
      const historyResult = await getUserWorkouts(user.uid);
      if (historyResult.success && historyResult.data) {
        workoutHistory = historyResult.data;
        console.log('[addWorkout] Loaded workout history:', workoutHistory.length, 'workouts');
      }
    } catch (error) {
      console.error("[addWorkout] Error loading workout history:", error);
    }

    // CASE 1: Plan has exercises - use them as template
    if (planDay.exercises && planDay.exercises.length > 0) {
      console.log('[addWorkout] Plan has exercises, using them as template');
      
      let newHistoryExercises: Record<string, WorkoutExercise> = {};

      // For each exercise in today's plan, find the most recent historical data
      const mergedExercises = planDay.exercises.map((planEx) => {
        console.log('[addWorkout] Processing exercise:', planEx.exerciseName);
        
        const historicalExercise = findMostRecentExercise(
          planEx.exerciseName,
          workoutHistory
        );

        if (historicalExercise) {
          console.log('[addWorkout] Found historical data for', planEx.exerciseName);
          newHistoryExercises[planEx.exerciseName.toLowerCase()] = historicalExercise;
        }

        // If we have historical data, use it as prefill
        if (historicalExercise) {
          return {
            exerciseName: planEx.exerciseName,
            sets: historicalExercise.sets.map((s: WorkoutSet) => ({
              reps: s.reps || 0,
              weight: s.weight || 0,
              weightUnit: s.weightUnit || "kg",
            })),
          };
        }

        // No history, use the plan's default values
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

      console.log('[addWorkout] Final exercises count:', mergedExercises.length);
      setHistoryExercises(newHistoryExercises);
      setExercises(mergedExercises as WorkoutExercise[]);
      return;
    }

    // CASE 2: Plan has NO exercises - load last complete workout
    console.log('[addWorkout] Plan has no exercises, loading last complete workout');
    
    if (workoutHistory.length === 0) {
      console.log('[addWorkout] No workout history found, starting with empty form');
      setExercises([{
        exerciseName: "",
        sets: [{ reps: 0, weight: 0, weightUnit: "kg" }],
      }]);
      setHistoryExercises({});
      return;
    }

    // Sort history by date descending (most recent first)
    const sortedHistory = [...workoutHistory].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Get the most recent workout
    const lastWorkout = sortedHistory[0];
    console.log('[addWorkout] Loading last workout from:', new Date(lastWorkout.date).toISOString());
    console.log('[addWorkout] Last workout had', lastWorkout.exercises?.length || 0, 'exercises');

    if (!lastWorkout.exercises || lastWorkout.exercises.length === 0) {
      console.log('[addWorkout] Last workout had no exercises, starting with empty form');
      setExercises([{
        exerciseName: "",
        sets: [{ reps: 0, weight: 0, weightUnit: "kg" }],
      }]);
      setHistoryExercises({});
      return;
    }

    // Build history lookup and exercises from last workout
    let newHistoryExercises: Record<string, WorkoutExercise> = {};
    
    const loadedExercises = lastWorkout.exercises.map((ex) => {
      newHistoryExercises[ex.exerciseName.toLowerCase()] = ex;
      
      return {
        exerciseName: ex.exerciseName,
        sets: ex.sets.map((s: WorkoutSet) => ({
          reps: s.reps || 0,
          weight: s.weight || 0,
          weightUnit: s.weightUnit || "kg",
        })),
      };
    });

    console.log('[addWorkout] Loaded', loadedExercises.length, 'exercises from last workout');
    setHistoryExercises(newHistoryExercises);
    setExercises(loadedExercises as WorkoutExercise[]);
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
        parseInt(value) || 0;
    } else if (field === "weight") {
      newExercises[exerciseIndex].sets[setIndex][field] =
        parseFloat(value) || 0;
    } else {
      newExercises[exerciseIndex].sets[setIndex][field] = value;
    }
    setExercises(newExercises);
  };

  const handleSave = async () => {
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

  /**
   * Helper function to get the historical set data for display
   */
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
                      />
                      <Typo
                        size={12}
                        color={colors.neutral400}
                        style={styles.unitLabel}
                      >
                        {set.weightUnit}
                      </Typo>
                    </View>

                    <TouchableOpacity
                      onPress={() => removeSet(exerciseIndex, setIndex)}
                      style={styles.removeSetButton}
                    >
                      <Icons.X size={16} color={colors.rose} weight="bold" />
                    </TouchableOpacity>
                  </View>
                );
              })}

              <TouchableOpacity
                onPress={() => addSet(exerciseIndex)}
                style={styles.addSetButton}
              >
                <Icons.Plus size={16} color={colors.primary} weight="bold" />
                <Typo size={14} fontWeight="600" color={colors.primary}>
                  Add Set
                </Typo>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity onPress={addExercise} style={styles.addExerciseButton}>
            <Icons.PlusCircle size={24} color={colors.primary} weight="fill" />
            <Typo size={16} fontWeight="600" color={colors.primary}>
              Add Exercise
            </Typo>
          </TouchableOpacity>
        </ScrollView>

        {/* Save Button - Fixed at bottom */}
        <View style={[styles.saveButtonContainer, { bottom: insets.bottom + 12 }]}>
          <Button onPress={handleSave} loading={loading}>
            <Typo size={18} fontWeight="700" color={colors.black}>
              Save Workout
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
    marginBottom: spacingY._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  currentTimeSection: {
    alignItems: "center",
    marginBottom: spacingY._15,
  },
  lapButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._7,
    backgroundColor: colors.primary,
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._20,
    borderRadius: radius._12,
    marginBottom: spacingY._15,
  },
  totalTimeSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
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
    alignItems: "flex-start",
    gap: spacingX._10,
    marginBottom: spacingY._15,
  },
  exerciseNameInput: {
    backgroundColor: colors.neutral700,
    marginBottom: spacingY._10,
  },
  historyContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
    backgroundColor: colors.neutral700,
    padding: spacingX._10,
    borderRadius: radius._10,
    marginTop: spacingY._5,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral700,
    alignItems: "center",
    justifyContent: "center",
  },
  setHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    marginBottom: spacingY._10,
    paddingHorizontal: spacingX._5,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    marginBottom: spacingY._10,
  },
  setNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.neutral700,
    alignItems: "center",
    justifyContent: "center",
  },
  setInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
  },
  smallInput: {
    flex: 1,
    backgroundColor: colors.neutral700,
    height: verticalScale(40),
  },
  unitLabel: {
    width: 24,
  },
  removeSetButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.neutral700,
    alignItems: "center",
    justifyContent: "center",
  },
  addSetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._7,
    paddingVertical: spacingY._10,
    marginTop: spacingY._10,
    borderRadius: radius._12,
    borderWidth: 1,
    borderColor: colors.primary,
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
  saveButtonContainer: {
    position: "absolute",
    left: spacingX._20,
    right: spacingX._20,
    zIndex: 10,
  },
});