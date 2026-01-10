import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Loading from "@/src/components/ui/Loading";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import {
  createWorkoutPlan,
  getUserWorkoutPlan,
  updateWorkoutPlan
} from "@/src/services/workoutPlanService";
import { DayWorkout, WorkoutPlan } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SPLIT_OPTIONS = [1, 2, 4, 7, 9, 14];

const WorkoutPlanScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const { workoutPlan, refreshPlan, deletePlan } = useWorkoutPlan();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [planName, setPlanName] = useState("");
  const [existingPlanId, setExistingPlanId] = useState<string | null>(null);
  const [splitDays, setSplitDays] = useState(1);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [days, setDays] = useState<DayWorkout[]>([]);

  const daysOfWeek = useMemo(() => {
    return Array.from({ length: splitDays }, (_, i) => `Day ${i + 1}`);
  }, [splitDays]);

  useEffect(() => {
    const newDays = daysOfWeek.map((day) => {
      const existingDay = days.find((d) => d.day === day);
      if (existingDay) {
        return existingDay;
      }
      return {
        day,
        isRestDay: false,
        exercises: [],
      };
    });
    setDays(newDays);
  }, [daysOfWeek]);

  useFocusEffect(
    useCallback(() => {
      loadWorkoutPlan();
    }, [user?.uid, workoutPlan])
  );

  useEffect(() => {
    if (workoutPlan?.days) {
      setDays(workoutPlan.days);
    }
  }, [workoutPlan?.days]);

  const loadWorkoutPlan = async () => {
    if (!user?.uid) return;
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

  const handleDayPress = (day: string) => {
    Haptics.selectionAsync();
    router.push({
      pathname: "/(modals)/dayWorkout",
      params: { day, planId: existingPlanId || "new" },
    });
  };

  const handleSave = async () => {
    if (!planName.trim()) {
      Alert.alert("Error", "Please add a name for your workout plan");
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
      createdAt: existingPlanId ? workoutPlan?.createdAt || new Date() : new Date(),
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
      if (!existingPlanId && result.data?.id) {
        setExistingPlanId(result.data.id);
      }
      await refreshPlan();
      Alert.alert("Success", "Workout plan saved successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } else {
      Alert.alert("Error", result.msg || "Could not save workout plan");
    }
  };

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "⚠️ Delete Everything?",
      "This will permanently delete:\n\n• Your workout plan\n• ALL workout history\n• All logged exercises\n\nThis action cannot be undone!",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete All", 
          style: "destructive", 
          onPress: performDelete 
        },
      ]
    );
  };

  const performDelete = async () => {
    setDeleting(true);
    const result = await deletePlan();
    setDeleting(false);
    
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "✅ Deleted Successfully", 
        result.msg || "All data has been removed",
        [
          { 
            text: "OK", 
            onPress: () => router.back() 
          }
        ]
      );
    } else {
      Alert.alert("Error", result.msg || "Could not delete workout plan");
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
    return days.filter(d => d.isRestDay).length;
  };

  const getWorkoutDaysCount = () => {
    return days.filter(d => !d.isRestDay && d.exercises.length > 0).length;
  };

  if (loading) {
    return (
      <ModalWrapper>
        <Header title="Workout Plan" leftIcon={<BackButton />} />
        <Loading />
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title={existingPlanId ? "Edit Plan" : "Create Plan"}
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._15 }}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            entering={FadeInDown.duration(400)}
            style={styles.inputContainer}
          >
            <Typo size={16} fontWeight="600" style={styles.label}>
              Plan Name
            </Typo>
            <Input
              placeholder="e.g., Push Pull Legs"
              value={planName}
              onChangeText={setPlanName}
              containerStyle={styles.input}
            />
          </Animated.View>

          <Animated.View 
            entering={FadeInDown.duration(400).delay(50)}
            style={styles.splitContainer}
          >
            <View style={styles.splitHeader}>
              <Typo size={16} fontWeight="600" style={styles.label}>
                Split Days (Cycle Length)
              </Typo>
              <TouchableOpacity
                onPress={() => setShowInfoModal(true)}
                style={styles.infoButton}
              >
                <Icons.Info size={20} color={colors.primary} weight="fill" />
              </TouchableOpacity>
            </View>

            <View style={styles.splitOptions}>
              {SPLIT_OPTIONS.map((option) => (
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
                Workout Days
              </Typo>
            </View>

            <View style={styles.statCard}>
              <Icons.Coffee size={24} color="#F59E0B" weight="fill" />
              <Typo size={20} fontWeight="700" color={colors.white}>
                {getRestDaysCount()}
              </Typo>
              <Typo size={12} color={colors.neutral400}>
                Rest Days
              </Typo>
            </View>

            <View style={styles.statCard}>
              <Icons.ListChecks size={24} color="#3B82F6" weight="fill" />
              <Typo size={20} fontWeight="700" color={colors.white}>
                {getTotalExercises()}
              </Typo>
              <Typo size={12} color={colors.neutral400}>
                Exercises
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
                        <Typo size={18} fontWeight="700" color={isRest ? colors.neutral400 : colors.white}>
                          {day}
                        </Typo>
                        {isRest && (
                          <View style={styles.restBadge}>
                            <Icons.Coffee size={14} color={colors.neutral400} weight="fill" />
                            <Typo size={12} color={colors.neutral400} fontWeight="600">Rest</Typo>
                          </View>
                        )}
                        {!isRest && hasExercises && (
                           <View style={styles.countBadge}>
                             <Typo size={12} color={colors.black} fontWeight="700">
                               {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
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
                             <Typo size={14} color={colors.neutral300} numberOfLines={1}>
                               {ex.exerciseName}
                             </Typo>
                             <Typo size={13} color={colors.neutral500}>
                               ({ex.sets.length} sets)
                             </Typo>
                          </View>
                        ))}
                        {exerciseCount > 3 && (
                          <Typo size={13} color={colors.primary} style={{ marginTop: 4, marginLeft: 14 }}>
                            + {exerciseCount - 3} more...
                          </Typo>
                        )}
                      </View>
                    )}

                    {!isRest && !hasExercises && (
                      <Typo size={14} color={colors.neutral500} style={{ marginTop: spacingY._5 }}>
                        Tap to add exercises...
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
                <View style={{ flex: 1 }}>
                  <Typo size={16} fontWeight="600" color={colors.rose}>
                    {deleting ? "Deleting..." : "Delete Plan & All Workouts"}
                  </Typo>
                  <Typo size={12} color={colors.neutral400} style={{ marginTop: 2 }}>
                    This will permanently remove all your workout data
                  </Typo>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>

        <View style={[styles.footerSticky, { bottom: insets.bottom + 12 }]}>
          <Button onPress={handleSave} loading={saving} style={styles.saveButton}>
            <Typo color={colors.black} fontWeight="700" size={18}>
              Save Changes
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
                <Typo size={18} fontWeight="700" style={{ flex: 1, marginLeft: 10 }}>
                  What is Split Days?
                </Typo>
                <TouchableOpacity onPress={() => setShowInfoModal(false)}>
                  <Icons.X size={24} color={colors.white} />
                </TouchableOpacity>
              </View>

              <View style={styles.infoContent}>
                <Typo size={15} color={colors.neutral200} style={{ lineHeight: 22 }}>
                  Split days represent the length of your workout cycle before it repeats.
                </Typo>

                <View style={styles.infoExamples}>
                  <View style={styles.exampleItem}>
                    <Typo size={14} fontWeight="600" color={colors.primary}>1-Day Split</Typo>
                    <Typo size={13} color={colors.neutral400}>Full Body Workout</Typo>
                  </View>

                  <View style={styles.exampleItem}>
                    <Typo size={14} fontWeight="600" color={colors.primary}>2-Day Split</Typo>
                    <Typo size={13} color={colors.neutral400}>Upper/Lower Body</Typo>
                  </View>

                  <View style={styles.exampleItem}>
                    <Typo size={14} fontWeight="600" color={colors.primary}>4-Day Split</Typo>
                    <Typo size={13} color={colors.neutral400}>Classic bodybuilding split</Typo>
                  </View>

                  <View style={styles.exampleItem}>
                    <Typo size={14} fontWeight="600" color={colors.primary}>7-Day Split</Typo>
                    <Typo size={13} color={colors.neutral400}>Weekly routine</Typo>
                  </View>
                </View>

                <Typo size={13} color={colors.neutral500} style={{ marginTop: 15, fontStyle: 'italic' }}>
                  Choose based on your training schedule and recovery needs.
                </Typo>
              </View>
            </View>
          </TouchableOpacity>
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
  splitContainer: {
    marginBottom: spacingY._25,
  },
  splitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingY._10,
  },
  infoButton: {
    padding: 4,
  },
  splitOptions: {
    flexDirection: 'row',
    gap: spacingX._10,
  },
  splitOption: {
    flex: 1,
    paddingVertical: spacingY._12,
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  splitOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacingX._10,
    marginBottom: spacingY._25,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    padding: spacingX._15,
    alignItems: 'center',
    borderWidth: 1,
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
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  dayCardActive: {
    borderColor: colors.neutral600,
  },
  dayCardRest: {
    backgroundColor: 'rgba(38, 38, 38, 0.5)',
    borderStyle: 'dashed',
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
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: radius._17,
    padding: spacingX._20,
    marginTop: spacingY._30,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  footerSticky: {
    position: "absolute",
    left: spacingX._20,
    right: spacingX._20,
    zIndex: 30,
  },
  saveButton: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingX._20,
  },
  infoModal: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
});