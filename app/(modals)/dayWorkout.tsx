import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useLanguage } from "@/src/contexts/languageContext";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import {
  DayWorkout as DayWorkoutPayload,
  WorkoutExercise,
  WorkoutSet,
} from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

const DayWorkout = () => {
  const { day } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useLanguage();
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
      Alert.alert(
        t("common_error"),
        t("common_validation_need_one_exercise"),
      );
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
      Alert.alert(t("common_error"), t("common_validation_need_one_set"));
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
    const payload: DayWorkoutPayload = {
      day: day as string,
      isRestDay: true,
      exercises: [],
    };
    console.log("[DayWorkout] mark rest day payload:", payload);

    await updateDay(day as string, payload);

    console.log("[DayWorkout] rest day saved, going back");
    setSaving(false);
    router.back();
  };

  const handleAddExercises = async () => {
    const hasEmptyExerciseName = exercises.some(
      (ex) => !ex.exerciseName.trim()
    );
    if (hasEmptyExerciseName) {
      Alert.alert(
        t("common_error"),
        t("common_validation_fill_exercise_names"),
      );
      return;
    }

    const hasInvalidSets = exercises.some((ex) =>
      ex.sets.some((set) => set.reps <= 0 || set.weight < 0)
    );
    if (hasInvalidSets) {
      Alert.alert(
        t("common_error"),
        t("common_validation_fill_reps_weight"),
      );
      return;
    }

    setSaving(true);
    const payload: DayWorkoutPayload = {
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

  const displayDayLabel = (() => {
    const rawDay = day as string;
    const match = rawDay?.match(/^Day\s+(\d+)$/i);
    if (match?.[1]) {
      return t("workout_plan_modal_day_label", { count: match[1] });
    }
    return rawDay;
  })();

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title={displayDayLabel}
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._15 }}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.restDayButton}
            onPress={handleMarkRestDay}
            disabled={saving}
          >
            <Typo size={16} fontWeight="600" color={colors.white}>
              {t("day_workout_modal_mark_rest_day")}
            </Typo>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Typo
              size={14}
              color={colors.neutral400}
              style={{ paddingHorizontal: spacingX._10 }}
            >
              {t("common_or")}
            </Typo>
            <View style={styles.dividerLine} />
          </View>

          <>
            <Typo
              size={18}
              fontWeight="600"
              style={{ marginBottom: spacingY._15 }}
            >
              {t("day_workout_modal_exercises_title")}
            </Typo>

            {exercises.map((exercise, exerciseIndex) => (
              <View key={exerciseIndex} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <Typo size={16} fontWeight="600">
                    {t("day_workout_modal_exercise_label", {
                      index: exerciseIndex + 1,
                    })}
                  </Typo>
                  {exercises.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeExercise(exerciseIndex)}
                      style={styles.removeButton}
                    >
                      <Icons.Trash size={20} color={colors.rose} />
                    </TouchableOpacity>
                  )}
                </View>

                <Input
                  placeholder={t("day_workout_modal_exercise_placeholder")}
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
                  {t("common_sets")}
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
                        placeholder={t("day_workout_modal_reps_placeholder")}
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
                        placeholder={t("day_workout_modal_weight_placeholder")}
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
                      style={styles.unitButton}
                      onPress={() => toggleWeightUnit(exerciseIndex, setIndex)}
                    >
                      <Typo size={13} fontWeight="600">
                        {set.weightUnit}
                      </Typo>
                    </TouchableOpacity>

                    {exercise.sets.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeSet(exerciseIndex, setIndex)}
                        style={styles.removeSetButton}
                      >
                        <Icons.Trash size={18} color={colors.rose} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.addSetButton}
                  onPress={() => addSet(exerciseIndex)}
                >
                  <Icons.Plus size={16} color={colors.primary} />
                  <Typo size={14} color={colors.primary}>
                    {t("day_workout_modal_add_set")}
                  </Typo>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={styles.addExerciseButton}
              onPress={addExercise}
            >
              <Icons.Plus size={20} color={colors.primary} />
              <Typo size={16} fontWeight="600" color={colors.primary}>
                {t("day_workout_modal_add_exercise")}
              </Typo>
            </TouchableOpacity>
          </>
        </ScrollView>

        <View style={[styles.footerSticky, { bottom: insets.bottom + 12 }]}>
          <Button
            onPress={handleAddExercises}
            loading={saving}
            style={{ flex: 1 }}
          >
            <Typo color={colors.black} fontWeight="700" size={16}>
              {t("day_workout_modal_save_exercises")}
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
