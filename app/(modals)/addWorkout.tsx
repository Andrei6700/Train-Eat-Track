import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useLanguage } from "@/src/contexts/languageContext";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import { LOCALE_BY_LANGUAGE } from "@/src/i18n/translations";
import { addWorkout, getUserWorkouts } from "@/src/services/workoutService";
import { WorkoutExercise, WorkoutHistory, WorkoutSet } from "@/src/types/index";
import { scale, verticalScale } from "@/src/utils/styling";
import { findLastSuccessfulWorkoutForCycleDay } from "@/src/utils/workoutPlanCycle";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AddWorkout = () => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const router = useRouter();
  const { workoutPlan } = useWorkoutPlan();
  const { selectedDate, isHistorical } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const activePageRef = useRef(activePage);

  // FIX: Parse and normalize the target date at component initialization
  // This ensures the date is set correctly and doesn't change during the session
  const targetDate = React.useMemo(() => {
    if (selectedDate) {
      const parsed = new Date(selectedDate as string);
      // Normalize to noon to avoid timezone issues
      parsed.setHours(12, 0, 0, 0);
      return parsed;
    }
    // Default to today if no date provided
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today;
  }, [selectedDate]);

  const isHistoricalWorkout = isHistorical === "true";

  // Timer states
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Calculate which day index in the split cycle the target date corresponds to
  const getTodayDayIndex = (): number => {
    if (!workoutPlan || !workoutPlan.splitDays) {
      if (__DEV__) {
        console.log("[addWorkout] No workout plan or splitDays");
      }
      return 0;
    }

    // Handle both Firestore Timestamp and Date objects
    let planCreatedDate: Date;
    if (
      workoutPlan.createdAt &&
      typeof workoutPlan.createdAt === "object" &&
      "toDate" in workoutPlan.createdAt
    ) {
      planCreatedDate = (workoutPlan.createdAt as any).toDate();
    } else {
      planCreatedDate = new Date(workoutPlan.createdAt);
    }
    planCreatedDate.setHours(0, 0, 0, 0);

    // CRITICAL FIX: Use targetDate instead of creating a new Date()
    const workoutDate = new Date(targetDate);
    workoutDate.setHours(0, 0, 0, 0);

    const daysDifference = Math.floor(
      (workoutDate.getTime() - planCreatedDate.getTime()) /
      (1000 * 60 * 60 * 24),
    );

    if (__DEV__) {
      console.log("[addWorkout] Plan created:", planCreatedDate.toISOString());
      console.log("[addWorkout] Target workout date:", workoutDate.toISOString());
      console.log("[addWorkout] Days difference:", daysDifference);
      console.log("[addWorkout] Split days:", workoutPlan.splitDays);
      console.log(
        "[addWorkout] Day index:",
        daysDifference % workoutPlan.splitDays,
      );
    }

    return daysDifference % workoutPlan.splitDays;
  };

  // Get the day name for target date based on split cycle
  const getTodayDayName = (): string => {
    const dayIndex = getTodayDayIndex();
    return `Day ${dayIndex + 1}`;
  };

  // Find the most recent workout that contains a specific exercise
  // Used to prefill weights and reps from previous sessions
  const findMostRecentExercise = (
    exerciseName: string,
    history: WorkoutHistory[],
  ): WorkoutExercise | null => {
    if (!history || history.length === 0) return null;

    const normalizedName = exerciseName.toLowerCase().trim();

    const sortedHistory = [...history].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    for (const workout of sortedHistory) {
      const exercise = workout.exercises?.find(
        (ex) => ex.exerciseName.toLowerCase().trim() === normalizedName,
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
   * Load workout data with proper split days support
   *
   * Priority 1: For first cycle - use workout plan exercises as template
   * Priority 2: For subsequent cycles - copy from previous cycle (splitDays days ago)
   * Priority 3: If no data available - start with empty form
   */
  const loadWorkoutData = async () => {
    if (!workoutPlan || !user?.uid) return;

    // FIX: Use targetDate for all calculations
    const workoutDate = new Date(targetDate);
    workoutDate.setHours(0, 0, 0, 0);

    // Handle both Firestore Timestamp and Date objects
    let planCreatedDate: Date;
    if (
      workoutPlan.createdAt &&
      typeof workoutPlan.createdAt === "object" &&
      "toDate" in workoutPlan.createdAt
    ) {
      planCreatedDate = (workoutPlan.createdAt as any).toDate();
    } else {
      planCreatedDate = new Date(workoutPlan.createdAt);
    }
    planCreatedDate.setHours(0, 0, 0, 0);

    const daysDifference = Math.floor(
      (workoutDate.getTime() - planCreatedDate.getTime()) /
      (1000 * 60 * 60 * 24),
    );

    // Calculate which day in the current cycle
    const currentDayIndex = daysDifference % (workoutPlan.splitDays ?? 1);
    const dayName = `Day ${currentDayIndex + 1}`;

    if (__DEV__) {
      console.log("[addWorkout] Days since plan created:", daysDifference);
      console.log("[addWorkout] Current cycle day:", dayName);
    }

    // Find the workout plan for the target date
    const planDay = workoutPlan.days?.find((d) => d.day === dayName);

    if (!planDay) {
      if (__DEV__) {
        console.log("[addWorkout] No plan found for", dayName);
      }
      return;
    }

    if (__DEV__) {
      console.log(
        "[addWorkout] Plan day found:",
        planDay.day,
        "Exercises:",
        planDay.exercises?.length || 0,
      );
    }

    // Load workout history for prefilling
    let workoutHistory: WorkoutHistory[] = [];
    try {
      const historyResult = await getUserWorkouts(user.uid);
      if (historyResult.success && historyResult.data) {
        workoutHistory = historyResult.data;
        if (__DEV__) {
          console.log(
            "[addWorkout] Loaded workout history:",
            workoutHistory.length,
            "workouts",
          );
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error("[addWorkout] Error loading workout history:", error);
      }
    }

    // Look for the most recent successful workout for this cycle day (searches all previous cycles)
    const previousCycleWorkout = findLastSuccessfulWorkoutForCycleDay(
      currentDayIndex,
      workoutDate,
      workoutHistory,
      workoutPlan,
    );

    if (previousCycleWorkout) {
      if (__DEV__) {
        console.log(
          "[addWorkout] Found previous workout for cycle day",
          currentDayIndex,
          "with",
          previousCycleWorkout.exercises?.length,
          "exercises",
        );
      }
    }

    // CASE 1: Plan has exercises - use them as template for FIRST CYCLE ONLY
    if (
      planDay.exercises &&
      planDay.exercises.length > 0 &&
      daysDifference < (workoutPlan.splitDays ?? 1)
    ) {
      if (__DEV__) {
        console.log(
          "[addWorkout] First cycle - using plan exercises as template",
        );
      }

      let newHistoryExercises: Record<string, WorkoutExercise> = {};

      const mergedExercises = planDay.exercises.map((planEx) => {
        const historicalExercise = findMostRecentExercise(
          planEx.exerciseName,
          workoutHistory,
        );

        if (historicalExercise) {
          newHistoryExercises[planEx.exerciseName.toLowerCase()] =
            historicalExercise;
        }

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

        return {
          exerciseName: planEx.exerciseName,
          sets: planEx.sets?.map((s) => ({
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

      setHistoryExercises(newHistoryExercises);
      setExercises(mergedExercises as WorkoutExercise[]);
      return;
    }

    // CASE 2: After first cycle - copy from previous cycle
    if (
      previousCycleWorkout &&
      previousCycleWorkout.exercises &&
      previousCycleWorkout.exercises.length > 0
    ) {
      if (__DEV__) {
        console.log(
          "[addWorkout] After first cycle - copying from previous cycle",
        );
      }

      let newHistoryExercises: Record<string, WorkoutExercise> = {};

      const loadedExercises = previousCycleWorkout.exercises.map((ex) => {
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

      if (__DEV__) {
        console.log(
          "[addWorkout] Loaded",
          loadedExercises.length,
          "exercises from previous cycle",
        );
      }
      setHistoryExercises(newHistoryExercises);
      setExercises(loadedExercises as WorkoutExercise[]);
      return;
    }

    // CASE 3: No previous workout found, start with empty form
    if (__DEV__) {
      console.log(
        "[addWorkout] No previous cycle workout found, starting with empty form",
      );
    }
    setExercises([
      {
        exerciseName: "",
        sets: [{ reps: 0, weight: 0, weightUnit: "kg" }],
      },
    ]);
    setHistoryExercises({});
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

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    activePageRef.current = activePage;
  }, [activePage]);

  const goToPage = (page: number) => {
    setActivePage(page);
    Keyboard.dismiss();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const absDx = Math.abs(gestureState.dx);
        const absDy = Math.abs(gestureState.dy);
        // High threshold to avoid capturing vertical scroll gestures
        return absDx > 30 && absDx > absDy * 2;
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: (_, gestureState) => {
        const shouldGoRight = gestureState.dx > 50 || gestureState.vx > 0.3;
        const shouldGoLeft = gestureState.dx < -50 || gestureState.vx < -0.3;
        const currentPage = activePageRef.current;

        if (currentPage === 1 && shouldGoRight) {
          goToPage(0);
          return;
        }
        if (currentPage === 0 && shouldGoLeft) {
          goToPage(1);
        }
      },
    }),
  ).current;

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const formatTargetDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return targetDate.toLocaleDateString(LOCALE_BY_LANGUAGE[language], options);
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
      Alert.alert(t("common_error"), t("common_validation_need_one_exercise"));
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
      Alert.alert(t("common_error"), t("common_validation_need_one_set"));
      return;
    }
    const newExercises = [...exercises];
    newExercises[exerciseIndex].sets = newExercises[exerciseIndex].sets.filter(
      (_, i) => i !== setIndex,
    );
    setExercises(newExercises);
  };

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: keyof WorkoutSet,
    value: any,
  ) => {
    const newExercises = [...exercises];
    if (field === "reps") {
      newExercises[exerciseIndex].sets[setIndex][field] = parseInt(value) || 0;
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

    if (!user?.uid) {
      Alert.alert(t("common_error"), t("common_error_not_authenticated"));
      return;
    }

    // FIX: Create a new date object from targetDate to ensure immutability
    // and proper date handling. Normalize to noon to avoid timezone issues.
    const workoutDateToSave = new Date(targetDate);
    workoutDateToSave.setHours(12, 0, 0, 0);

    if (__DEV__) {
      console.log(
        "[addWorkout] Saving workout for date:",
        workoutDateToSave.toISOString(),
      );
      console.log("[addWorkout] Is historical:", isHistoricalWorkout);
    }

    const workoutData = {
      userID: user.uid,
      date: workoutDateToSave, // Use the properly set target date
      duration: totalTime,
      exercises,
    };

    setLoading(true);
    try {
      const result = await addWorkout(workoutData as any);
      setLoading(false);

      if (result.success) {
        const isOffline = result.data?.offline;

        Alert.alert(
          isOffline ? t("common_saved_offline_title") : t("common_success"),
          isOffline
            ? t("add_workout_modal_saved_offline_message")
            : isHistoricalWorkout
              ? t("add_workout_modal_logged_success_for_date", {
                date: formatTargetDate(),
              })
              : t("add_workout_modal_saved_success_message"),
          [
            {
              text: t("common_ok"),
              onPress: () => {
                router.push({
                  pathname: "/(tabs)/history",
                  params: { refresh: "true" },
                });
              },
            },
          ],
        );
      } else {
        if (result.code === "SYNC_CONFLICT") {
          Alert.alert(
            t("add_workout_modal_sync_conflict_title"),
            t("add_workout_modal_sync_conflict_message"),
          );
        } else {
          Alert.alert(
            t("common_error"),
            result.msg || t("add_workout_modal_error_save"),
          );
        }
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert(
        t("common_error"),
        err?.message || t("add_workout_modal_error_save"),
      );
    }
  };

  // Helper function to get the historical set data for display
  const getHistoricalSet = (
    exerciseName: string,
    setIndex: number,
  ): WorkoutSet | null => {
    const histEx = historyExercises[exerciseName.toLowerCase()];
    if (histEx && histEx.sets && histEx.sets[setIndex]) {
      return histEx.sets[setIndex];
    }
    return null;
  };

  return (
    <ModalWrapper>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <View style={styles.container}>
          <Header
            title={
              isHistoricalWorkout
                ? t("add_workout_modal_title_log_past")
                : t("add_workout_modal_title_log")
            }
            leftIcon={<BackButton />}
            style={styles.headerMargin}
          />

          {/* Historical Date Banner */}
          {isHistoricalWorkout && (
            <View style={styles.historicalBanner}>
              <Icons.ClockCounterClockwise
                size={20}
                color={colors.primary}
                weight="fill"
              />
              <View style={styles.flexOne}>
                <Typo size={13} fontWeight="600" color={colors.primary}>
                  {t("add_workout_modal_logging_for")}
                </Typo>
                <Typo size={14} color={colors.white}>
                  {formatTargetDate()}
                </Typo>
              </View>
            </View>
          )}

          <View style={styles.pageSwitch}>
            <TouchableOpacity
              onPress={() => goToPage(0)}
              style={[
                styles.pageSwitchButton,
                activePage === 0 && styles.pageSwitchButtonActive,
              ]}
            >
              <Icons.Timer
                size={16}
                color={activePage === 0 ? colors.black : colors.neutral300}
                weight="bold"
              />
              <Typo
                size={12}
                fontWeight="700"
                color={activePage === 0 ? colors.black : colors.neutral300}
              >
                {t("add_workout_modal_tab_timer")}
              </Typo>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => goToPage(1)}
              style={[
                styles.pageSwitchButton,
                activePage === 1 && styles.pageSwitchButtonActive,
              ]}
            >
              <Icons.Barbell
                size={16}
                color={activePage === 1 ? colors.black : colors.neutral300}
                weight="bold"
              />
              <Typo
                size={12}
                fontWeight="700"
                color={activePage === 1 ? colors.black : colors.neutral300}
              >
                {t("add_workout_modal_tab_workout_log")}
              </Typo>
            </TouchableOpacity>
          </View>

          <View style={styles.pageFrame} {...panResponder.panHandlers}>
            {activePage === 0 ? (
              <View style={styles.timerPage}>
                {/* Timer Container */}
                <View style={styles.timerContainer}>
                  <View style={styles.currentTimeSection}>
                    <Typo
                      size={12}
                      color={colors.neutral400}
                      style={styles.restTimerLabel}
                    >
                      {t("add_workout_modal_rest_timer")}
                    </Typo>
                    <Typo size={44} fontWeight="700" color={colors.primary}>
                      {formatTime(currentTime)}
                    </Typo>
                  </View>
                  <View style={styles.timerStatsRow}>
                    <View style={styles.timerStatCard}>
                      <Typo size={11} color={colors.neutral400}>
                        {t("add_workout_modal_total_time")}
                      </Typo>
                      <Typo size={16} fontWeight="600" color={colors.white}>
                        {formatTime(totalTime)}
                      </Typo>
                    </View>
                    <View style={styles.timerStatCard}>
                      <Typo size={11} color={colors.neutral400}>
                        {t("add_workout_modal_target_date")}
                      </Typo>
                      <Typo size={14} fontWeight="600" color={colors.white}>
                        {targetDate.toLocaleDateString(
                          LOCALE_BY_LANGUAGE[language],
                          {
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </Typo>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={handleLap}
                    style={styles.lapButton}
                  >
                    <Icons.ArrowCounterClockwise
                      size={18}
                      color={colors.black}
                      weight="bold"
                    />
                    <Typo size={14} fontWeight="700" color={colors.black}>
                      {t("add_workout_modal_reset_rest")}
                    </Typo>
                  </TouchableOpacity>
                </View>

                <View style={styles.timerHintCard}>
                  <Icons.ArrowsHorizontal
                    size={18}
                    color={colors.primary}
                    weight="bold"
                  />
                  <Typo
                    size={13}
                    color={colors.neutral300}
                    style={styles.flexOne}
                  >
                    {t("add_workout_modal_swipe_hint")}
                  </Typo>
                </View>

                <TouchableOpacity
                  onPress={() => goToPage(1)}
                  style={styles.timerActionButton}
                >
                  <Icons.CaretRight
                    size={16}
                    color={colors.black}
                    weight="bold"
                  />
                  <Typo size={14} fontWeight="700" color={colors.black}>
                    {t("add_workout_modal_go_to_workout_log")}
                  </Typo>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.page}>
                <View style={styles.workoutTopRow}>
                  <Typo size={16} fontWeight="700">
                    {t("add_workout_modal_exercises")}
                  </Typo>
                  <TouchableOpacity
                    onPress={() => goToPage(0)}
                    style={styles.timerBadge}
                  >
                    <Icons.Timer
                      size={14}
                      color={colors.primary}
                      weight="bold"
                    />
                    <Typo size={12} fontWeight="600" color={colors.primary}>
                      {formatTime(currentTime)}
                    </Typo>
                  </TouchableOpacity>
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
                  nestedScrollEnabled
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

                      {exercise.sets.map((set, setIndex) => {
                        const historicalSet = getHistoricalSet(
                          exercise.exerciseName,
                          setIndex,
                        );

                        return (
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

                            {/* Input Reps with historical placeholder */}
                            <View style={styles.setInput}>
                              <Input
                                placeholder={
                                  historicalSet
                                    ? `${historicalSet.reps}`
                                    : "0"
                                }
                                keyboardType="numeric"
                                value={
                                  set.reps > 0 ? set.reps.toString() : ""
                                }
                                onChangeText={(text) =>
                                  updateSet(
                                    exerciseIndex,
                                    setIndex,
                                    "reps",
                                    text,
                                  )
                                }
                                containerStyle={styles.smallInput}
                                inputStyle={styles.smallInputText}
                              />
                            </View>

                            {/* Input Weight with historical placeholder */}
                            <View style={styles.setInput}>
                              <Input
                                placeholder={
                                  historicalSet
                                    ? `${historicalSet.weight}`
                                    : "0"
                                }
                                keyboardType="numeric"
                                value={
                                  set.weight > 0 ? set.weight.toString() : ""
                                }
                                onChangeText={(text) =>
                                  updateSet(
                                    exerciseIndex,
                                    setIndex,
                                    "weight",
                                    text,
                                  )
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
                              onPress={() =>
                                removeSet(exerciseIndex, setIndex)
                              }
                              style={styles.removeSetButton}
                            >
                              <Icons.X
                                size={16}
                                color={colors.rose}
                                weight="bold"
                              />
                            </TouchableOpacity>
                          </View>
                        );
                      })}

                      <TouchableOpacity
                        onPress={() => addSet(exerciseIndex)}
                        style={styles.addSetButton}
                      >
                        <Icons.Plus
                          size={16}
                          color={colors.primary}
                          weight="bold"
                        />
                        <Typo
                          size={14}
                          fontWeight="600"
                          color={colors.primary}
                        >
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
              </View>
            )}
          </View>

          {!isKeyboardVisible && activePage === 1 && (
            <View
              style={[
                styles.saveButtonContainer,
                { paddingBottom: Math.max(insets.bottom, spacingY._10) },
              ]}
            >
              <Button onPress={handleSave} loading={loading}>
                <Typo size={18} fontWeight="700" color={colors.black}>
                  {isHistoricalWorkout
                    ? t("add_workout_modal_log_workout")
                    : t("add_workout_modal_save_workout")}
                </Typo>
              </Button>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </ModalWrapper>
  );
};

export default AddWorkout;

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  historicalBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    backgroundColor: "rgba(163, 230, 53, 0.1)",
    borderRadius: radius._12,
    padding: spacingX._15,
    marginBottom: spacingY._12,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  pageSwitch: {
    flexDirection: "row",
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    borderWidth: 2,
    borderColor: colors.neutral700,
    padding: spacingX._5,
    marginBottom: spacingY._12,
    gap: spacingX._7,
  },
  pageSwitchButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._7,
    paddingVertical: spacingY._7,
    borderRadius: radius._10,
  },
  pageSwitchButtonActive: {
    backgroundColor: colors.primary,
  },
  pageFrame: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  timerPage: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: spacingY._20,
  },
  timerContainer: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    marginBottom: spacingY._12,
    borderWidth: 2,
    borderColor: colors.neutral700,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  currentTimeSection: {
    alignItems: "center",
    marginBottom: spacingY._12,
  },
  timerStatsRow: {
    flexDirection: "row",
    gap: spacingX._10,
    marginBottom: spacingY._12,
  },
  timerStatCard: {
    flex: 1,
    backgroundColor: colors.neutral700,
    borderRadius: radius._12,
    borderWidth: 2,
    borderColor: colors.neutral600,
    paddingHorizontal: spacingX._10,
    paddingVertical: spacingY._10,
    alignItems: "center",
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
    marginBottom: spacingY._12,
  },
  totalTimeSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  timerHintCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    borderWidth: 2,
    borderColor: colors.neutral700,
    paddingHorizontal: spacingX._12,
    paddingVertical: spacingY._10,
    marginBottom: spacingY._12,
  },
  timerActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._7,
    paddingVertical: spacingY._10,
    borderRadius: radius._12,
    backgroundColor: colors.primary,
  },
  workoutTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacingY._10,
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._5,
    paddingHorizontal: spacingX._10,
    paddingVertical: spacingY._5,
    backgroundColor: "rgba(163, 230, 53, 0.08)",
    borderRadius: radius._10,
    borderWidth: 2,
    borderColor: "rgba(163, 230, 53, 0.25)",
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
    textAlign: "center",
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
  headerMargin: {
    marginBottom: spacingY._12,
  },
  restTimerLabel: {
    marginBottom: spacingY._5,
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

