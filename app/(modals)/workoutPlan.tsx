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
import { verticalScale, scale } from "@/src/utils/styling";
import { useFocusEffect, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from 'expo-haptics'; 

const DAYS_OF_WEEK = [
  "Luni",
  "Marti",
  "Miercuri",
  "Joi",
  "Vineri",
  "Sambata",
  "Duminica",
];

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
  const [days, setDays] = useState<DayWorkout[]>(
    DAYS_OF_WEEK.map((day) => ({
      day,
      isRestDay: false,
      exercises: [],
    }))
  );

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
      setDays(result.data.days);
    } else {
      setExistingPlanId(null);
    }
    setLoading(false);
  };

  const handleDayPress = (day: string) => {
    Haptics.selectionAsync(); // tactile feedback
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
      "Delete Workout Plan",
      "Are you sure? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ]
    );
  };

  const performDelete = async () => {
    setDeleting(true);
    const result = await deletePlan();
    setDeleting(false);
    if (result.success) {
      router.back();
    } else {
      Alert.alert("Error", result.msg || "Could not delete workout plan");
    }
  };

  const getDayStatus = (day: string) => {
    const dayData = days.find((d) => d.day === day);
    if (!dayData) return null;
    return dayData;
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
          {/* Plan Name Input */}
          <View style={styles.inputContainer}>
            <Typo size={16} fontWeight="600" style={{ marginBottom: spacingY._10, marginLeft: spacingX._5 }}>
              Plan Name
            </Typo>
            <Input
              placeholder="e.g., Push Pull Legs"
              value={planName}
              onChangeText={setPlanName}
              containerStyle={styles.input}
            />
          </View>

          <View style={styles.daysContainer}>
            {DAYS_OF_WEEK.map((day) => {
              const dayData = getDayStatus(day);
              const isRest = dayData?.isRestDay;
              const hasExercises = dayData && dayData.exercises.length > 0;
              const exerciseCount = dayData?.exercises.length || 0;

              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayCard,
                    isRest && styles.dayCardRest,
                    hasExercises && styles.dayCardActive,
                  ]}
                  onPress={() => handleDayPress(day)}
                  activeOpacity={0.9} // Visual feedback when pressed
                >
                  {/* Card Header */}
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
                           <Typo size={12} color={colors.black} fontWeight="700">{exerciseCount} exercises</Typo>
                         </View>
                      )}
                    </View>
                    <Icons.CaretRight size={20} color={colors.neutral500} />
                  </View>

                  {/* Card Body - Exercise Summary */}
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
              );
            })}
          </View>

          {existingPlanId && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={deleting}
            >
              <Icons.Trash size={20} color={colors.rose} />
              <Typo size={16} fontWeight="600" color={colors.rose}>
                {deleting ? "Deleting..." : "Delete Plan"}
              </Typo>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={[styles.footerSticky, { bottom: insets.bottom + 12 }]}>
          <Button onPress={handleSave} loading={saving} style={styles.saveButton}>
            <Typo color={colors.black} fontWeight="700" size={18}>
              Save Changes
            </Typo>
          </Button>
        </View>
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
    marginBottom: spacingY._25,
  },
  input: {
    backgroundColor: colors.neutral800,
    borderColor: colors.neutral700,
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
    // Shadow for "Visual Polish"
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  dayCardActive: {
    borderColor: colors.neutral600, // Slightly lighter border for active days
    backgroundColor: colors.neutral800,
  },
  dayCardRest: {
    backgroundColor: 'rgba(38, 38, 38, 0.5)', // neutral800 with opacity
    borderColor: 'transparent',
    borderStyle: 'dashed',
    borderWidth: 1,
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
    justifyContent: "center",
    gap: spacingX._10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)', // Rose with opacity
    borderRadius: radius._17,
    padding: spacingY._15,
    marginTop: spacingY._30,
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
  }
});