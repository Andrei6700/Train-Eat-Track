import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import { WorkoutExercise, WorkoutSet } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DayWorkout = () => {
  const { day } = useLocalSearchParams();
  const router = useRouter();
  const { workoutPlan, updateDay } = useWorkoutPlan();
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();
  const [exercises, setExercises] = useState<WorkoutExercise[]>([
    {
      exerciseName: "",
      sets: [{ reps: 0, weight: 0, weightUnit: "kg" }],
    },
  ]);

  useEffect(() => {
    if (workoutPlan && day) {
      const existingDay = workoutPlan.days.find((d) => d.day === day);
      if (existingDay) {
        if (existingDay.exercises.length > 0) {
          setExercises(existingDay.exercises);
        }
      }
    }
  }, [workoutPlan, day]);

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
    newExercises[exerciseIndex].sets[setIndex][field] = value;
    setExercises(newExercises);
  };

  const toggleWeightUnit = (exerciseIndex: number, setIndex: number) => {
    const newExercises = [...exercises];
    const currentUnit = newExercises[exerciseIndex].sets[setIndex].weightUnit;
    newExercises[exerciseIndex].sets[setIndex].weightUnit =
      currentUnit === "kg" ? "lbs" : "kg";
    setExercises(newExercises);
  };

  const handleMarkRestDay = async () => {
    setSaving(true);
    const payload: DayWorkout = {
      day: day as string,
      isRestDay: true,
      exercises: [],
    };
    console.log("[DayWorkout] mark rest day payload:", payload);

    await updateDay(day as string, payload);

    console.log("[DayWorkout] rest day saved locally, going back");
    setSaving(false);
    router.back();
  };

  const handleAddExercises = async () => {
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
      Alert.alert("Error", "Please fill in valid reps and weight for all sets");
      return;
    }

    setSaving(true);
    const payload: DayWorkout = {
      day: day as string,
      isRestDay: false,
      exercises,
    };

    console.log(
      "[DayWorkout] saving exercises payload:",
      JSON.stringify(payload)
    );
    await updateDay(day as string, payload);
    console.log(
      "[DayWorkout] updateDay finished - local context should be updated"
    );

    setSaving(false);
    router.back();
  };

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title={day as string}
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._15 }}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Rest Day Button */}
          <TouchableOpacity
            style={styles.restDayButton}
            onPress={handleMarkRestDay}
            disabled={saving}
          >
            <Typo size={16} fontWeight="600" color={colors.white}>
              Mark as Rest Day
            </Typo>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Typo
              size={14}
              color={colors.neutral400}
              style={{ paddingHorizontal: spacingX._10 }}
            >
              or
            </Typo>
            <View style={styles.dividerLine} />
          </View>

          {/* Exercises Section */}
          <>
            <Typo
              size={18}
              fontWeight="600"
              style={{ marginBottom: spacingY._15 }}
            >
              Exercises
            </Typo>

            {exercises.map((exercise, exerciseIndex) => (
              <View key={exerciseIndex} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <Typo size={16} fontWeight="600">
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
                  onChangeText={(text) =>
                    updateExerciseName(exerciseIndex, text)
                  }
                  containerStyle={{ marginBottom: spacingY._15 }}
                />

                <Typo
                  size={14}
                  fontWeight="500"
                  style={{ marginBottom: spacingY._10 }}
                >
                  Sets
                </Typo>

                {exercise.sets.map((set, setIndex) => (
                  <View key={setIndex} style={styles.setRow}>
                    <View style={styles.setNumber}>
                      <Typo size={13} color={colors.neutral400}>
                        {setIndex + 1}
                      </Typo>
                    </View>

                    <View style={styles.setInput}>
                      <Input
                        placeholder="Reps"
                        keyboardType="numeric"
                        value={set.reps > 0 ? set.reps.toString() : ""}
                        onChangeText={(text) =>
                          updateSet(
                            exerciseIndex,
                            setIndex,
                            "reps",
                            parseInt(text) || 0
                          )
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
                          updateSet(
                            exerciseIndex,
                            setIndex,
                            "weight",
                            parseFloat(text) || 0
                          )
                        }
                        containerStyle={styles.smallInput}
                      />
                    </View>

                    <TouchableOpacity
                      onPress={() => toggleWeightUnit(exerciseIndex, setIndex)}
                      style={styles.unitButton}
                    >
                      <Typo size={13} fontWeight="600" color={colors.primary}>
                        {set.weightUnit}
                      </Typo>
                    </TouchableOpacity>

                    {exercise.sets.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeSet(exerciseIndex, setIndex)}
                        style={styles.removeSetButton}
                      >
                        <Icons.XIcon size={16} color={colors.rose} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                <TouchableOpacity
                  onPress={() => addSet(exerciseIndex)}
                  style={styles.addSetButton}
                >
                  <Icons.PlusIcon size={16} color={colors.primary} />
                  <Typo size={13} fontWeight="500" color={colors.primary}>
                    Add Set
                  </Typo>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              onPress={addExercise}
              style={styles.addExerciseButton}
            >
              <Icons.PlusCircleIcon
                size={22}
                color={colors.primary}
                weight="fill"
              />
              <Typo size={15} fontWeight="600" color={colors.primary}>
                Add Exercise
              </Typo>
            </TouchableOpacity>
          </>
        </ScrollView>

        {/* Footer - Save Button */}
        <View style={[styles.footerSticky, { bottom: insets.bottom + 12 }]}>
          <Button
            onPress={handleAddExercises}
            loading={saving}
            style={{ flex: 1 }}
          >
            <Typo color={colors.black} fontWeight="700" size={16}>
              Save Exercises
            </Typo>
          </Button>
        </View>
      </View>
    </ModalWrapper>
  );
};

export default DayWorkout;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  scrollContent: {
    paddingBottom: verticalScale(20),
    gap: spacingY._10,
  },
  restDayButton: {
    backgroundColor: colors.primary,
    borderRadius: radius._15,
    paddingVertical: spacingY._15,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacingY._20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.neutral600,
  },
  exerciseCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    padding: spacingX._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
    marginBottom: spacingY._12,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._12,
  },
  removeButton: {
    padding: spacingX._5,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
    marginBottom: spacingY._10,
  },
  setNumber: {
    width: verticalScale(26),
    height: verticalScale(26),
    borderRadius: 100,
    backgroundColor: colors.neutral700,
    alignItems: "center",
    justifyContent: "center",
  },
  setInput: {
    flex: 1,
  },
  smallInput: {
    height: verticalScale(42),
  },
  unitButton: {
    backgroundColor: colors.neutral700,
    paddingHorizontal: spacingX._10,
    paddingVertical: verticalScale(8),
    borderRadius: radius._10,
    minWidth: verticalScale(45),
    alignItems: "center",
  },
  removeSetButton: {
    padding: spacingX._3,
  },
  addSetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._5,
    paddingVertical: spacingY._10,
    marginTop: spacingY._7,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius._10,
    borderStyle: "dashed",
  },
  addExerciseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._10,
    paddingVertical: spacingY._12,
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
  },
  footer: {
    paddingTop: spacingY._15,
    borderTopWidth: 1,
    borderTopColor: colors.neutral700,
    marginBottom: spacingY._5,
  },
  footerSticky: {
    position: "absolute",
    left: spacingX._20,
    right: spacingX._20,
    zIndex: 30,
  },
});