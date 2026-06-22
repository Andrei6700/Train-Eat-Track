import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Loading from "@/src/components/ui/Loading";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useLanguage } from "@/src/contexts/languageContext";
import { getWorkout, updateWorkout } from "@/src/services/workoutService";
import { WorkoutExercise, WorkoutHistory, WorkoutSet } from "@/src/types/index";
import { scale, verticalScale } from "@/src/utils/styling";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const EditWorkout = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const navigation = useNavigation();
  const { workoutId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const isSavingRef = useRef(false);
  const [originalWorkout, setOriginalWorkout] =
    useState<WorkoutHistory | null>(null);

  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);

  // ─── Load workout on mount ────────────────────────────────────────
  useEffect(() => {
    if (!workoutId || !user?.uid) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const result = await getWorkout(workoutId as string, user.uid);
      if (cancelled) return;

      if (result.success && result.data) {
        const workout = result.data as WorkoutHistory;
        setOriginalWorkout(workout);
        setExercises(
          workout.exercises?.map((ex) => ({
            exerciseName: ex.exerciseName,
            sets: ex.sets.map((s: WorkoutSet) => ({
              reps: s.reps || 0,
              weight: s.weight || 0,
              weightUnit: s.weightUnit || "kg",
            })),
          })) || [],
        );
      } else {
        Alert.alert(
          t("common_error"),
          result.msg || t("edit_workout_modal_error_load"),
        );
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [workoutId, user?.uid]);

  // ─── Exit confirmation ────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (isSavingRef.current) return;
      e.preventDefault();
      Alert.alert(
        t("add_workout_modal_exit_confirm_title") || "Exit?",
        t("add_workout_modal_exit_confirm_message") ||
          "Are you sure you want to leave? Your changes will be discarded.",
        [
          {
            text: t("common_cancel") || "Cancel",
            style: "cancel",
            onPress: () => {},
          },
          {
            text: t("common_ok") || "OK",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, t]);

  // ─── Keyboard listeners ───────────────────────────────────────────
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () =>
      setIsKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(hideEvent, () =>
      setIsKeyboardVisible(false),
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ─── Exercise helpers ─────────────────────────────────────────────
  const addExercise = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExercises((prev) => [
      ...prev,
      { exerciseName: "", sets: [{ reps: 0, weight: 0, weightUnit: "kg" }] },
    ]);
  }, []);

  const removeExercise = useCallback(
    (index: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (exercises.length === 1) {
        Alert.alert(
          t("common_error"),
          t("common_validation_need_one_exercise"),
        );
        return;
      }
      setExercises((prev) => prev.filter((_, i) => i !== index));
    },
    [exercises.length, t],
  );

  const updateExerciseName = useCallback(
    (index: number, name: string) => {
      setExercises((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], exerciseName: name };
        return next;
      });
    },
    [],
  );

  const addSet = useCallback((exerciseIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExercises((prev) => {
      const next = [...prev];
      const exercise = { ...next[exerciseIndex] };
      const lastSet = exercise.sets[exercise.sets.length - 1];
      exercise.sets = [
        ...exercise.sets,
        {
          reps: lastSet?.reps || 0,
          weight: lastSet?.weight || 0,
          weightUnit: lastSet?.weightUnit || "kg",
        },
      ];
      next[exerciseIndex] = exercise;
      return next;
    });
  }, []);

  const removeSet = useCallback(
    (exerciseIndex: number, setIndex: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (exercises[exerciseIndex]?.sets.length === 1) {
        Alert.alert(t("common_error"), t("common_validation_need_one_set"));
        return;
      }
      setExercises((prev) => {
        const next = [...prev];
        const exercise = { ...next[exerciseIndex] };
        exercise.sets = exercise.sets.filter((_, i) => i !== setIndex);
        next[exerciseIndex] = exercise;
        return next;
      });
    },
    [exercises, t],
  );

  const updateSet = useCallback(
    (
      exerciseIndex: number,
      setIndex: number,
      field: keyof WorkoutSet,
      value: any,
    ) => {
      setExercises((prev) => {
        const next = [...prev];
        const exercise = { ...next[exerciseIndex] };
        const sets = [...exercise.sets];
        const set = { ...sets[setIndex] };
        if (field === "reps") {
          set.reps = parseInt(value) || 0;
        } else if (field === "weight") {
          set.weight = parseFloat(value) || 0;
        } else {
          (set as any)[field] = value;
        }
        sets[setIndex] = set;
        exercise.sets = sets;
        next[exerciseIndex] = exercise;
        return next;
      });
    },
    [],
  );

  // ─── Save ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!originalWorkout || !user?.uid) return;

    const hasEmptyExerciseName = exercises.some(
      (ex) => !ex.exerciseName.trim(),
    );
    if (hasEmptyExerciseName) {
      Alert.alert(
        t("common_error"),
        t("common_validation_fill_exercise_names"),
      );
      return;
    }

    const hasInvalidSets = exercises.some((ex) =>
      ex.sets.some((set) => set.reps <= 0 || set.weight < 0),
    );
    if (hasInvalidSets) {
      Alert.alert(t("common_error"), t("common_validation_fill_reps_weight"));
      return;
    }

    const updatedWorkout: WorkoutHistory = {
      ...originalWorkout,
      userID: user.uid,
      exercises,
    };

    setSaving(true);
    try {
      const result = await updateWorkout(updatedWorkout);
      setSaving(false);

      if (result.success) {
        isSavingRef.current = true;
        const isOffline = result.data?.offline;

        Alert.alert(
          isOffline ? t("common_saved_offline_title") : t("common_success"),
          isOffline
            ? t("add_workout_modal_saved_offline_message")
            : t("edit_workout_modal_success"),
          [
            {
              text: t("common_ok"),
              onPress: () => {
                router.push({
                  pathname: "/(tabs)/workout",
                  params: { refresh: "true" },
                });
              },
            },
          ],
        );
      } else {
        Alert.alert(
          t("common_error"),
          result.msg || t("edit_workout_modal_error_save"),
        );
      }
    } catch (err: any) {
      setSaving(false);
      Alert.alert(
        t("common_error"),
        err?.message || t("edit_workout_modal_error_save"),
      );
    }
  }, [exercises, originalWorkout, router, t, user?.uid]);

  // ─── Loading state ────────────────────────────────────────────────
  if (loading) {
    return (
      <ModalWrapper>
        <View style={styles.container}>
          <Header
            title={t("edit_workout_modal_title")}
            leftIcon={<BackButton />}
            style={styles.headerMargin}
          />
        </View>
        <Loading />
      </ModalWrapper>
    );
  }

  if (!originalWorkout) {
    return (
      <ModalWrapper>
        <View style={styles.container}>
          <Header
            title={t("edit_workout_modal_title")}
            leftIcon={<BackButton />}
            style={styles.headerMargin}
          />
          <View style={styles.emptyContainer}>
            <Typo size={16} color={colors.neutral400}>
              {t("edit_workout_modal_error_load")}
            </Typo>
          </View>
        </View>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <View style={styles.container}>
          <Header
            title={t("edit_workout_modal_title")}
            leftIcon={<BackButton />}
            style={styles.headerMargin}
          />

          <View style={styles.workoutTopRow}>
            <Typo size={16} fontWeight="700">
              {t("add_workout_modal_exercises")}
            </Typo>
            <View style={styles.exerciseCountBadge}>
              <Typo size={13} fontWeight="600" color={colors.neutral300}>
                {exercises.length} {t("common_exercises")}
              </Typo>
            </View>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            onScrollBeginDrag={Keyboard.dismiss}
          >
            {exercises.map((exercise, exerciseIndex) => (
              <View key={exerciseIndex} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <View style={styles.flexOne}>
                    <Typo
                      size={16}
                      fontWeight="600"
                      color={colors.neutral300}
                      style={styles.exerciseLabelMargin}
                    >
                      {t("add_workout_modal_exercise_label", {
                        index: exerciseIndex + 1,
                      })}
                    </Typo>
                    <Input
                      placeholder={t(
                        "add_workout_modal_exercise_name_placeholder",
                      )}
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
                    style={styles.setHeaderLabel}
                  >
                    {t("add_workout_modal_set_label")}
                  </Typo>
                  <Typo
                    size={12}
                    color={colors.neutral400}
                    style={styles.setHeaderLabelFlex}
                  >
                    {t("add_workout_modal_reps_label")}
                  </Typo>
                  <Typo
                    size={12}
                    color={colors.neutral400}
                    style={styles.setHeaderLabelFlex}
                  >
                    {t("add_workout_modal_weight_label")}
                  </Typo>
                  <View style={styles.setHeaderSpacer} />
                </View>

                {exercise.sets.map((set, setIndex) => (
                  <View key={setIndex} style={styles.setRow}>
                    <View style={styles.setNumber}>
                      <Typo
                        size={14}
                        fontWeight="600"
                        color={colors.neutral400}
                      >
                        {setIndex + 1}
                      </Typo>
                    </View>

                    {/* Input Reps */}
                    <View style={styles.setInput}>
                      <Input
                        placeholder="0"
                        keyboardType="numeric"
                        value={set.reps > 0 ? set.reps.toString() : ""}
                        onChangeText={(text) =>
                          updateSet(exerciseIndex, setIndex, "reps", text)
                        }
                        containerStyle={styles.smallInput}
                        inputStyle={styles.smallInputText}
                      />
                    </View>

                    {/* Input Weight */}
                    <View style={styles.setInput}>
                      <Input
                        placeholder="0"
                        keyboardType="numeric"
                        value={set.weight > 0 ? set.weight.toString() : ""}
                        onChangeText={(text) =>
                          updateSet(exerciseIndex, setIndex, "weight", text)
                        }
                        containerStyle={styles.smallInput}
                        inputStyle={styles.smallInputText}
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
                      <Icons.X
                        size={16}
                        color={colors.rose}
                        weight="bold"
                      />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity
                  onPress={() => addSet(exerciseIndex)}
                  style={styles.addSetButton}
                >
                  <Icons.Plus
                    size={16}
                    color={colors.primary}
                    weight="bold"
                  />
                  <Typo size={14} fontWeight="600" color={colors.primary}>
                    {t("add_workout_modal_add_set")}
                  </Typo>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              onPress={addExercise}
              style={styles.addExerciseButton}
            >
              <Icons.PlusCircle
                size={24}
                color={colors.primary}
                weight="fill"
              />
              <Typo size={16} fontWeight="600" color={colors.primary}>
                {t("add_workout_modal_add_exercise")}
              </Typo>
            </TouchableOpacity>
          </ScrollView>

          {!isKeyboardVisible && (
            <View
              style={[
                styles.saveButtonContainer,
                { paddingBottom: Math.max(insets.bottom, spacingY._10) },
              ]}
            >
              <Button onPress={handleSave} loading={saving}>
                <Typo size={18} fontWeight="700" color={colors.black}>
                  {t("edit_workout_modal_save")}
                </Typo>
              </Button>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </ModalWrapper>
  );
};

export default EditWorkout;

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  headerMargin: {
    marginBottom: spacingY._12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  workoutTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacingY._10,
  },
  exerciseCountBadge: {
    backgroundColor: colors.neutral800,
    paddingHorizontal: spacingX._12,
    paddingVertical: verticalScale(4),
    borderRadius: radius._10,
    borderWidth: 1.5,
    borderColor: colors.neutral700,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: spacingY._15,
    paddingBottom: verticalScale(120),
  },
  exerciseCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._15,
    borderWidth: 2,
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
  removeButton: {
    width: scale(36),
    height: verticalScale(36),
    borderRadius: scale(18),
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
    width: scale(30),
    height: verticalScale(30),
    borderRadius: scale(15),
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
    borderWidth: 1,
    borderColor: colors.border,
    height: verticalScale(44),
    minHeight: verticalScale(44),
    paddingHorizontal: spacingX._10,
    paddingVertical: 0,
  },
  smallInputText: {
    color: colors.textLight,
    textAlign: "center" as const,
  },
  unitLabel: {
    width: 24,
  },
  removeSetButton: {
    width: scale(30),
    height: verticalScale(30),
    borderRadius: scale(15),
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
    borderWidth: 2,
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
    paddingTop: spacingY._10,
    backgroundColor: colors.neutral800,
  },
  flexOne: {
    flex: 1,
  },
  exerciseLabelMargin: {
    marginBottom: 4,
  },
  setHeaderLabel: {
    width: scale(30),
    textAlign: "center" as const,
  },
  setHeaderLabelFlex: {
    flex: 1,
    textAlign: "center" as const,
  },
  setHeaderSpacer: {
    width: scale(30),
  },
});
