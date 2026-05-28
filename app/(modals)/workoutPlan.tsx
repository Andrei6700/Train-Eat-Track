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
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import { getTemplateById } from "@/src/data/workoutTemplates";
import { importWorkoutPlanFromExcel } from "@/src/services/workoutPlanImportService";
import {
    createWorkoutPlan,
    getUserWorkoutPlan,
    updateWorkoutPlan,
} from "@/src/services/workoutPlanService";
import { DayWorkout, WorkoutPlan } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SPLIT_OPTIONS = [1, 2, 4, 7, 9, 14];
const MIN_CUSTOM_SPLIT_DAYS = 1;
const MAX_CUSTOM_SPLIT_DAYS = 60;
const FOOTER_BUTTON_HEIGHT = verticalScale(52);
const WEEKLY_CYCLE_DAYS = 7;

const normalizeWeekdayLabel = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[ăâ]/g, "a")
    .replace(/î/g, "i")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t")
    .trim();
};

const getWeekdayIndex = (value: string): number | null => {
  const normalized = normalizeWeekdayLabel(value);
  if (normalized.startsWith("luni")) return 0;
  if (normalized.startsWith("marti")) return 1;
  if (normalized.startsWith("miercuri")) return 2;
  if (normalized.startsWith("joi")) return 3;
  if (normalized.startsWith("vineri")) return 4;
  if (normalized.startsWith("sambata")) return 5;
  if (normalized.startsWith("duminica")) return 6;
  return null;
};

const normalizeTemplateToCycleDays = (template: {
  daysPerWeek: number;
  splitDays: string[];
  days: DayWorkout[];
}): { normalizedDays: DayWorkout[]; cycleLength: number } => {
  const workoutDays = template.days.filter((day) => !day.isRestDay);
  const splitDayIndexes = template.splitDays.map((splitLabel) => {
    const weekDayToken = splitLabel.split("(")[0]?.trim() || splitLabel;
    return getWeekdayIndex(weekDayToken);
  });

  const hasValidWeeklyMapping =
    workoutDays.length > 0 &&
    splitDayIndexes.length === workoutDays.length &&
    splitDayIndexes.every((index) => index !== null) &&
    new Set(splitDayIndexes).size === splitDayIndexes.length;

  if (hasValidWeeklyMapping && workoutDays.length < WEEKLY_CYCLE_DAYS) {
    const weeklyDays: DayWorkout[] = Array.from(
      { length: WEEKLY_CYCLE_DAYS },
      (_, index) => ({
        day: `Day ${index + 1}`,
        isRestDay: true,
        exercises: [],
      }),
    );

    workoutDays.forEach((workoutDay, index) => {
      const targetDayIndex = splitDayIndexes[index];
      if (targetDayIndex === null) return;

      weeklyDays[targetDayIndex] = {
        ...workoutDay,
        day: `Day ${targetDayIndex + 1}`,
        isRestDay: false,
      };
    });

    return {
      normalizedDays: weeklyDays,
      cycleLength: WEEKLY_CYCLE_DAYS,
    };
  }

  const normalizedDays = template.days.map((day, index) => ({
    ...day,
    day: `Day ${index + 1}`,
  }));

  return {
    normalizedDays,
    cycleLength: Math.max(normalizedDays.length, template.daysPerWeek, 1),
  };
};

const WorkoutPlanScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const params = useLocalSearchParams<{
    templateId?: string;
    fromImport?: string;
  }>();
  const { workoutPlan, refreshPlan, deletePlan, setPlanDraft, clearPlanDraft } =
    useWorkoutPlan();
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [planName, setPlanName] = useState("");
  const [existingPlanId, setExistingPlanId] = useState<string | null>(null);
  const [splitDays, setSplitDays] = useState(1);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showCustomSplitModal, setShowCustomSplitModal] = useState(false);
  const [customSplitInput, setCustomSplitInput] = useState("");
  const [days, setDays] = useState<DayWorkout[]>([]);
  const [isFromTemplate, setIsFromTemplate] = useState(false);
  const [isFromImport, setIsFromImport] = useState(false);
  
  const workoutPlanRef = useRef(workoutPlan);
  useEffect(() => {
    workoutPlanRef.current = workoutPlan;
  }, [workoutPlan]);

  const footerBottomOffset = insets.bottom + spacingY._12;
  const footerReserve =
    footerBottomOffset + FOOTER_BUTTON_HEIGHT + spacingY._15;

  const daysOfWeek = useMemo(() => {
    return Array.from({ length: splitDays }, (_, i) => `Day ${i + 1}`);
  }, [splitDays]);

  const availableSplitOptions = useMemo(() => {
    return Array.from(new Set([...SPLIT_OPTIONS, splitDays])).sort(
      (a, b) => a - b,
    );
  }, [splitDays]);

  useEffect(() => {
    setDays((previousDays) => {
      return daysOfWeek.map((day) => {
        const existingDay = previousDays.find((d) => d.day === day);
        if (existingDay) {
          return existingDay;
        }
        return {
          day,
          isRestDay: false,
          exercises: [],
        };
      });
    });
  }, [daysOfWeek]);

  useFocusEffect(
    useCallback(() => {
      loadWorkoutPlan();
    }, [
      user?.uid,
      workoutPlan?.id,
      params.templateId as string,
      params.fromImport as string,
    ]),
  );

  useEffect(() => {
    if (workoutPlan?.days) {
      setDays(workoutPlan.days);
    }
  }, [workoutPlan?.days]);

  const loadWorkoutPlan = async () => {
    if (!user?.uid) return;

    const currentWorkoutPlan = workoutPlanRef.current;

    // Check if we have template data in params
    if (params.templateId) {
      if (currentWorkoutPlan && !currentWorkoutPlan.id && currentWorkoutPlan.days.length > 0) {
        setExistingPlanId(null);
        setPlanName(currentWorkoutPlan.planName || "");
        setSplitDays(currentWorkoutPlan.splitDays || 1);
        setDays(currentWorkoutPlan.days);
        setIsFromTemplate(true);
        setIsFromImport(false);
        setLoading(false);
        return;
      }

      const template = getTemplateById(params.templateId as string);
      if (template) {
        const { normalizedDays, cycleLength } =
          normalizeTemplateToCycleDays(template);

        setExistingPlanId(null);
        setPlanName(template.name); // Auto-fill template name
        setSplitDays(cycleLength);
        setDays(normalizedDays);
        setIsFromTemplate(true);
        setIsFromImport(false);
        setLoading(false);
        return;
      }
    }

    // Check if we have imported data from context (set by selection screen)
    if (params.fromImport && currentWorkoutPlan && !currentWorkoutPlan.id) {
      setExistingPlanId(null);
      setPlanName(currentWorkoutPlan.planName || "");
      setSplitDays(currentWorkoutPlan.splitDays || 1);
      setDays(currentWorkoutPlan.days || []);
      setIsFromTemplate(false);
      setIsFromImport(true);
      setLoading(false);
      return;
    }

    // Custom plan (no template, no import)
    if (!params.templateId && !params.fromImport) {
      setIsFromTemplate(false);
      setIsFromImport(false);
    }

    // Otherwise, load existing plan if available
    if (currentWorkoutPlan && !currentWorkoutPlan.id) {
      setExistingPlanId(null);
      setPlanName(currentWorkoutPlan.planName || "");
      setSplitDays(currentWorkoutPlan.splitDays || 1);
      setDays(currentWorkoutPlan.days || []);
      setLoading(false);
      return;
    }

    const result = await getUserWorkoutPlan(user.uid);
    if (result.success && result.data) {
      setExistingPlanId(result.data.id || null);
      if (result.data.planName && (!planName || planName === "")) {
        setPlanName(result.data.planName);
      }
      if (result.data.splitDays) {
        setSplitDays(result.data.splitDays);
      }
      setDays(result.data.days);
    } else {
      setExistingPlanId(null);
    }
    setLoading(false);
  };

  const buildCurrentDraftPlan = (): WorkoutPlan | null => {
    if (!user?.uid) return null;
    return {
      userID: user.uid,
      planName: planName.trim(),
      splitDays,
      days,
      createdAt: workoutPlan?.createdAt || new Date(),
      updatedAt: new Date(),
    };
  };

  const handleClose = () => {
    if (!existingPlanId) {
      clearPlanDraft();
    }
    router.back();
  };

  const handleDayPress = (day: string) => {
    Haptics.selectionAsync();

    if (!existingPlanId) {
      const currentDraft = buildCurrentDraftPlan();
      if (currentDraft) {
        setPlanDraft(currentDraft);
      }
    }

    router.push({
      pathname: "/(modals)/dayWorkout",
      params: { day, planId: existingPlanId || "new" },
    });
  };

  const handleSave = async () => {
    if (!planName.trim()) {
      Alert.alert(
        t("common_error"),
        t("workout_plan_modal_alert_missing_name"),
      );
      return;
    }
    if (!user?.uid) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(true);

    const planData: WorkoutPlan = {
      userID: user.uid,
      planName: planName.trim(),
      splitDays,
      days,
      createdAt: existingPlanId
        ? workoutPlan?.createdAt || new Date()
        : new Date(),
      updatedAt: new Date(),
    };

    let result;
    if (existingPlanId) {
      result = await updateWorkoutPlan(existingPlanId, planData);
    } else {
      result = await createWorkoutPlan(planData);
    }

    setSaving(false);

    if (result.success) {
      const queuedOffline =
        result.code === "SYNC_QUEUED_OFFLINE" ||
        result.code === "SYNC_RETRY_SCHEDULED";

      if (!existingPlanId && result.data?.id) {
        setExistingPlanId(result.data.id);
      }

      if (!queuedOffline) {
        await refreshPlan();
      }

      clearPlanDraft();

      Alert.alert(
        queuedOffline ? t("common_saved_offline_title") : t("common_success"),
        queuedOffline
          ? t("workout_plan_modal_saved_offline_message")
          : t("workout_plan_modal_saved_success_message"),
        [{ text: t("common_ok"), onPress: () => router.replace("/(tabs)/workout") }],
      );
    } else {
      Alert.alert(
        t("common_error"),
        result.msg || t("workout_plan_modal_error_save"),
      );
    }
  };

  const handleImportWorkoutPlan = async () => {
    if (existingPlanId || importing) return;

    Haptics.selectionAsync();
    setImporting(true);
    const result = await importWorkoutPlanFromExcel();
    setImporting(false);

    if (!result.success) {
      if (result.code === "PICKER_CANCELLED") {
        return;
      }

      const fallbackMsg =
        result.code === "INVALID_FILE_TYPE"
          ? t("workout_plan_modal_import_error_invalid_file")
          : result.code === "UNSUPPORTED_FORMAT"
            ? t("workout_plan_modal_import_error_unsupported")
            : t("workout_plan_modal_import_error_generic");

      const details = result.errors?.length
        ? `\n\n${result.errors.slice(0, 6).join("\n")}`
        : "";
      Alert.alert(t("common_error"), `${result.msg || fallbackMsg}${details}`);
      return;
    }

    if (!result.data) {
      Alert.alert(
        t("common_error"),
        t("workout_plan_modal_import_error_generic"),
      );
      return;
    }

    const importedPlan = result.data;
    setPlanName(importedPlan.planName);
    setSplitDays(importedPlan.splitDays);
    setDays(importedPlan.days);
    if (user?.uid) {
      setPlanDraft({
        userID: user.uid,
        planName: importedPlan.planName,
        splitDays: importedPlan.splitDays,
        days: importedPlan.days,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const importedExerciseCount = importedPlan.days.reduce((total, day) => {
      return total + (day.exercises?.length || 0);
    }, 0);

    Alert.alert(
      t("common_success"),
      t("workout_plan_modal_import_success", {
        splitDays: importedPlan.splitDays,
        exercises: importedExerciseCount,
      }),
    );
  };

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      t("workout_plan_modal_delete_confirm_title"),
      t("workout_plan_modal_delete_confirm_message"),
      [
        { text: t("common_cancel"), style: "cancel" },
        {
          text: t("workout_plan_modal_delete_confirm_action"),
          style: "destructive",
          onPress: performDelete,
        },
      ],
    );
  };

  const performDelete = async () => {
    setDeleting(true);
    const result = await deletePlan();
    setDeleting(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearPlanDraft();
      Alert.alert(
        t("workout_plan_modal_delete_success_title"),
        result.msg || t("workout_plan_modal_delete_success_message"),
        [
          {
            text: t("common_ok"),
            onPress: () => router.back(),
          },
        ],
      );
    } else {
      Alert.alert(
        t("common_error"),
        result.msg || t("workout_plan_modal_error_delete"),
      );
    }
  };

  const getDayStatus = (day: string) => {
    const dayData = days.find((d) => d.day === day);
    if (!dayData) return null;
    return dayData;
  };

  const getTotalExercises = () => {
    return days.reduce((total, day) => {
      return total + (day.exercises?.length || 0);
    }, 0);
  };

  const getRestDaysCount = () => {
    return days.filter((d) => d.isRestDay).length;
  };

  const getWorkoutDaysCount = () => {
    return days.filter((d) => !d.isRestDay && d.exercises.length > 0).length;
  };

  const getDisplayDayLabel = (dayValue: string) => {
    const match = dayValue.match(/^Day\s+(\d+)$/i);
    if (!match?.[1]) return dayValue;
    return t("workout_plan_modal_day_label", { count: match[1] });
  };

  const openCustomSplitModal = () => {
    setCustomSplitInput(String(splitDays));
    setShowCustomSplitModal(true);
  };

  const applyCustomSplitDays = () => {
    const trimmedValue = customSplitInput.trim();
    const parsedValue = Number(trimmedValue);
    const isValidInteger = /^\d+$/.test(trimmedValue);

    if (
      !isValidInteger ||
      !Number.isInteger(parsedValue) ||
      parsedValue < MIN_CUSTOM_SPLIT_DAYS ||
      parsedValue > MAX_CUSTOM_SPLIT_DAYS
    ) {
      Alert.alert(
        t("common_error"),
        t("workout_plan_modal_custom_split_invalid"),
      );
      return;
    }

    Haptics.selectionAsync();
    setSplitDays(parsedValue);
    setShowCustomSplitModal(false);
  };

  if (loading) {
    return (
      <ModalWrapper>
        <Header
          title={t("workout_plan_modal_title")}
          leftIcon={<BackButton />}
        />
        <Loading />
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title={
            existingPlanId
              ? t("workout_plan_modal_edit_title")
              : t("workout_plan_modal_create_title")
          }
          leftIcon={<BackButton onPress={handleClose} />}
          style={styles.headerMargin}
        />

        <KeyboardAvoidingView
          style={styles.flexOne}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: footerReserve },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={styles.inputContainer}
          >
            <Typo size={16} fontWeight="600" style={styles.label}>
              {t("workout_plan_modal_plan_name_label")}
            </Typo>
            <Input
              placeholder={t("workout_plan_modal_plan_name_placeholder")}
              value={planName}
              onChangeText={setPlanName}
              containerStyle={styles.input}
            />
          </Animated.View>

          {!existingPlanId && !isFromTemplate && !isFromImport && (
            <Animated.View
              entering={FadeInDown.duration(400).delay(40)}
              style={styles.importContainer}
            >
              <TouchableOpacity
                style={[
                  styles.importButton,
                  importing && styles.importButtonDisabled,
                ]}
                onPress={handleImportWorkoutPlan}
                disabled={importing}
                activeOpacity={0.85}
              >
                <Icons.FileXls size={20} color={colors.primary} weight="fill" />
                <View style={styles.flexOne}>
                  <Typo size={15} fontWeight="700" color={colors.white}>
                    {importing
                      ? t("workout_plan_modal_import_loading")
                      : t("workout_plan_modal_import_button")}
                  </Typo>
                  <Typo
                    size={12}
                    color={colors.neutral400}
                    style={styles.marginTop2}
                  >
                    {t("workout_plan_modal_import_caption")}
                  </Typo>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}

          <Animated.View
            entering={FadeInDown.duration(400).delay(50)}
            style={styles.splitContainer}
          >
            <View style={styles.splitHeader}>
              <Typo size={16} fontWeight="600" style={styles.label}>
                {t("workout_plan_modal_split_days_label")}
              </Typo>
              <TouchableOpacity
                onPress={() => setShowInfoModal(true)}
                style={styles.infoButton}
              >
                <Icons.Info size={20} color={colors.primary} weight="fill" />
              </TouchableOpacity>
            </View>

            <View style={styles.splitOptions}>
              {availableSplitOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.splitOption,
                    splitDays === option && styles.splitOptionActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSplitDays(option);
                  }}
                >
                  <Typo
                    size={15}
                    fontWeight="600"
                    color={splitDays === option ? colors.black : colors.white}
                  >
                    {option}
                  </Typo>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.splitOptionCustom}
                onPress={openCustomSplitModal}
                activeOpacity={0.85}
              >
                <Icons.Plus size={14} color={colors.primary} weight="bold" />
                <Typo size={14} fontWeight="600" color={colors.primary}>
                  {t("workout_plan_modal_custom_split_button")}
                </Typo>
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(400).delay(100)}
            style={styles.statsContainer}
          >
            <View style={styles.statCard}>
              <Icons.Barbell size={24} color={colors.primary} weight="fill" />
              <Typo size={20} fontWeight="700" color={colors.white}>
                {getWorkoutDaysCount()}
              </Typo>
              <Typo size={12} color={colors.neutral400}>
                {t("workout_plan_modal_stat_workout_days")}
              </Typo>
            </View>

            <View style={styles.statCard}>
              <Icons.Coffee size={24} color="#F59E0B" weight="fill" />
              <Typo size={20} fontWeight="700" color={colors.white}>
                {getRestDaysCount()}
              </Typo>
              <Typo size={12} color={colors.neutral400}>
                {t("workout_plan_modal_stat_rest_days")}
              </Typo>
            </View>

            <View style={styles.statCard}>
              <Icons.ListChecks size={24} color="#3B82F6" weight="fill" />
              <Typo size={20} fontWeight="700" color={colors.white}>
                {getTotalExercises()}
              </Typo>
              <Typo size={12} color={colors.neutral400}>
                {t("workout_plan_modal_stat_exercises")}
              </Typo>
            </View>
          </Animated.View>

          <View style={styles.daysContainer}>
            {daysOfWeek.map((day, index) => {
              const dayData = getDayStatus(day);
              const isRest = dayData?.isRestDay;
              const hasExercises = dayData && dayData.exercises.length > 0;
              const exerciseCount = dayData?.exercises.length || 0;

              return (
                <Animated.View
                  key={day}
                  entering={FadeInRight.duration(400).delay(index * 50)}
                >
                  <TouchableOpacity
                    style={[
                      styles.dayCard,
                      isRest && styles.dayCardRest,
                      hasExercises && styles.dayCardActive,
                    ]}
                    onPress={() => handleDayPress(day)}
                    activeOpacity={0.9}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.dayTitleRow}>
                        <Typo
                          size={18}
                          fontWeight="700"
                          color={isRest ? colors.neutral400 : colors.white}
                        >
                          {getDisplayDayLabel(day)}
                        </Typo>
                        {isRest && (
                          <View style={styles.restBadge}>
                            <Icons.Coffee
                              size={14}
                              color={colors.neutral400}
                              weight="fill"
                            />
                            <Typo
                              size={12}
                              color={colors.neutral400}
                              fontWeight="600"
                            >
                              {t("workout_plan_modal_rest_badge")}
                            </Typo>
                          </View>
                        )}
                        {!isRest && hasExercises && (
                          <View style={styles.countBadge}>
                            <Typo
                              size={12}
                              color={colors.black}
                              fontWeight="700"
                            >
                              {exerciseCount}{" "}
                              {exerciseCount === 1
                                ? t("workout_plan_modal_exercise_singular")
                                : t("workout_plan_modal_exercise_plural")}
                            </Typo>
                          </View>
                        )}
                      </View>
                      <Icons.CaretRight size={20} color={colors.neutral500} />
                    </View>

                    {!isRest && hasExercises && (
                      <View style={styles.cardBody}>
                        {dayData.exercises.slice(0, 3).map((ex, idx) => (
                          <View key={idx} style={styles.exerciseRow}>
                            <View style={styles.dot} />
                            <Typo
                              size={14}
                              color={colors.neutral300}
                              textProps={{ numberOfLines: 1 }}
                            >
                              {ex.exerciseName}
                            </Typo>
                            <Typo size={13} color={colors.neutral500}>
                              {t("workout_plan_modal_sets_count", {
                                count: ex.sets.length,
                              })}
                            </Typo>
                          </View>
                        ))}
                        {exerciseCount > 3 && (
                          <Typo
                            size={13}
                            color={colors.primary}
                            style={styles.moreExercisesText}
                          >
                            {t("workout_plan_modal_more_exercises", {
                              count: exerciseCount - 3,
                            })}
                          </Typo>
                        )}
                      </View>
                    )}

                    {!isRest && !hasExercises && (
                      <Typo
                        size={14}
                        color={colors.neutral500}
                        style={styles.tapAddExercisesText}
                      >
                        {t("workout_plan_modal_tap_add_exercises")}
                      </Typo>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          {existingPlanId && (
            <Animated.View entering={FadeInDown.duration(400).delay(400)}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
                disabled={deleting}
              >
                <Icons.Trash size={20} color={colors.rose} weight="fill" />
                <View style={styles.flexOne}>
                  <Typo size={16} fontWeight="600" color={colors.rose}>
                    {deleting
                      ? t("workout_plan_modal_delete_button_loading")
                      : t("workout_plan_modal_delete_button")}
                  </Typo>
                  <Typo
                    size={12}
                    color={colors.neutral400}
                    style={styles.marginTop2}
                  >
                    {t("workout_plan_modal_delete_caption")}
                  </Typo>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
        </KeyboardAvoidingView>

        <View style={[styles.footerSticky, { bottom: footerBottomOffset }]}>
          <Button onPress={handleSave} loading={saving}>
            <Typo color={colors.black} fontWeight="700" size={18}>
              {t("workout_plan_modal_save_changes")}
            </Typo>
          </Button>
        </View>

        <Modal
          visible={showInfoModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowInfoModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowInfoModal(false)}
          >
            <View style={styles.infoModal}>
              <View style={styles.infoHeader}>
                <Icons.Info size={24} color={colors.primary} weight="fill" />
                <Typo
                  size={18}
                  fontWeight="700"
                  style={styles.infoModalTitle}
                >
                  {t("workout_plan_modal_info_title")}
                </Typo>
                <TouchableOpacity onPress={() => setShowInfoModal(false)}>
                  <Icons.X size={24} color={colors.white} />
                </TouchableOpacity>
              </View>

              <View style={styles.infoContent}>
                <Typo
                  size={15}
                  color={colors.neutral200}
                  style={styles.infoModalDesc}
                >
                  {t("workout_plan_modal_info_desc")}
                </Typo>

                <View style={styles.infoExamples}>
                  <View style={styles.exampleItem}>
                    <Typo size={14} fontWeight="600" color={colors.primary}>
                      {t("workout_plan_modal_info_example_1_title")}
                    </Typo>
                    <Typo size={13} color={colors.neutral400}>
                      {t("workout_plan_modal_info_example_1_desc")}
                    </Typo>
                  </View>

                  <View style={styles.exampleItem}>
                    <Typo size={14} fontWeight="600" color={colors.primary}>
                      {t("workout_plan_modal_info_example_2_title")}
                    </Typo>
                    <Typo size={13} color={colors.neutral400}>
                      {t("workout_plan_modal_info_example_2_desc")}
                    </Typo>
                  </View>

                  <View style={styles.exampleItem}>
                    <Typo size={14} fontWeight="600" color={colors.primary}>
                      {t("workout_plan_modal_info_example_3_title")}
                    </Typo>
                    <Typo size={13} color={colors.neutral400}>
                      {t("workout_plan_modal_info_example_3_desc")}
                    </Typo>
                  </View>

                  <View style={styles.exampleItem}>
                    <Typo size={14} fontWeight="600" color={colors.primary}>
                      {t("workout_plan_modal_info_example_4_title")}
                    </Typo>
                    <Typo size={13} color={colors.neutral400}>
                      {t("workout_plan_modal_info_example_4_desc")}
                    </Typo>
                  </View>
                </View>

                <Typo
                  size={13}
                  color={colors.neutral500}
                  style={styles.infoModalFooterText}
                >
                  {t("workout_plan_modal_info_footer")}
                </Typo>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={showCustomSplitModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCustomSplitModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.flexOne}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowCustomSplitModal(false)}
            >
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {}}
              style={styles.customSplitModal}
            >
              <Typo size={18} fontWeight="700" style={styles.customSplitTitle}>
                {t("workout_plan_modal_custom_split_title")}
              </Typo>
              <Typo size={14} color={colors.neutral400}>
                {t("workout_plan_modal_custom_split_hint")}
              </Typo>

              <Input
                value={customSplitInput}
                onChangeText={setCustomSplitInput}
                placeholder={t("workout_plan_modal_custom_split_placeholder")}
                keyboardType="number-pad"
                containerStyle={styles.customSplitInput}
                autoFocus
              />

              <View style={styles.customSplitActions}>
                <TouchableOpacity
                  style={styles.customSplitCancelButton}
                  onPress={() => setShowCustomSplitModal(false)}
                  activeOpacity={0.85}
                >
                  <Typo size={15} fontWeight="600" color={colors.neutral300}>
                    {t("common_cancel")}
                  </Typo>
                </TouchableOpacity>
                <Button
                  onPress={applyCustomSplitDays}
                  style={styles.customSplitApplyButton}
                >
                  <Typo size={15} fontWeight="700" color={colors.black}>
                    {t("workout_plan_modal_custom_split_apply")}
                  </Typo>
                </Button>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </ModalWrapper>
  );
};

export default WorkoutPlanScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  scrollContent: {
    paddingBottom: verticalScale(120),
  },
  inputContainer: {
    marginBottom: spacingY._20,
  },
  label: {
    marginBottom: spacingY._10,
    marginLeft: spacingX._5,
  },
  input: {
    backgroundColor: colors.neutral800,
    borderColor: colors.neutral700,
  },
  importContainer: {
    marginBottom: spacingY._20,
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    borderWidth: 2,
    borderColor: colors.neutral700,
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._15,
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  splitContainer: {
    marginBottom: spacingY._25,
  },
  splitHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacingY._10,
  },
  infoButton: {
    padding: 4,
  },
  splitOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacingX._10,
  },
  splitOption: {
    minWidth: verticalScale(52),
    paddingHorizontal: spacingX._15,
    paddingVertical: spacingY._12,
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.neutral700,
  },
  splitOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  splitOptionCustom: {
    minWidth: verticalScale(98),
    paddingHorizontal: spacingX._15,
    paddingVertical: spacingY._12,
    backgroundColor: colors.neutral900,
    borderRadius: radius._12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacingX._7,
    borderWidth: 2,
    borderColor: colors.neutral700,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacingX._10,
    marginBottom: spacingY._25,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    padding: spacingX._15,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.neutral700,
    gap: verticalScale(4),
  },
  daysContainer: {
    gap: spacingY._15,
  },
  dayCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._15,
    borderWidth: 2,
    borderColor: colors.neutral700,
  },
  dayCardActive: {
    borderColor: colors.neutral600,
  },
  dayCardRest: {
    backgroundColor: "rgba(38, 38, 38, 0.5)",
    borderStyle: "dashed",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  restBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.neutral700,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius._6,
  },
  countBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius._6,
  },
  cardBody: {
    marginTop: spacingY._10,
    paddingTop: spacingY._10,
    borderTopWidth: 1,
    borderTopColor: colors.neutral700,
    gap: verticalScale(4),
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: radius._17,
    padding: spacingX._20,
    marginTop: spacingY._15,
    borderWidth: 2,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  footerSticky: {
    position: "absolute",
    left: spacingX._20,
    right: spacingX._20,
    zIndex: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacingX._20,
  },
  infoModal: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._20,
    width: "100%",
    maxWidth: 400,
    borderWidth: 2,
    borderColor: colors.neutral700,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacingX._20,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral700,
  },
  infoContent: {
    padding: spacingX._20,
  },
  infoExamples: {
    marginTop: 20,
    gap: 12,
  },
  exampleItem: {
    backgroundColor: colors.neutral900,
    padding: spacingX._15,
    borderRadius: radius._12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  customSplitModal: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._20,
    width: "100%",
    maxWidth: 420,
    borderWidth: 2,
    borderColor: colors.neutral700,
    padding: spacingX._20,
    gap: spacingY._12,
  },
  customSplitTitle: {
    marginBottom: spacingY._5,
  },
  customSplitInput: {
    marginTop: spacingY._10,
    backgroundColor: colors.neutral900,
    borderColor: colors.neutral700,
  },
  customSplitActions: {
    marginTop: spacingY._7,
    flexDirection: "row",
    gap: spacingX._10,
    alignItems: "center",
  },
  customSplitCancelButton: {
    flex: 1,
    height: verticalScale(52),
    borderRadius: radius._17,
    borderWidth: 2,
    borderColor: colors.neutral700,
    backgroundColor: colors.neutral900,
    justifyContent: "center",
    alignItems: "center",
  },
  customSplitApplyButton: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  headerMargin: {
    marginBottom: spacingY._15,
  },
  marginTop2: {
    marginTop: 2,
  },
  moreExercisesText: {
    marginTop: 4,
    marginLeft: 14,
  },
  tapAddExercisesText: {
    marginTop: spacingY._5,
  },
  infoModalTitle: {
    flex: 1,
    marginLeft: 10,
  },
  infoModalDesc: {
    lineHeight: 22,
  },
  infoModalFooterText: {
    marginTop: 15,
    fontStyle: "italic",
  },
});
