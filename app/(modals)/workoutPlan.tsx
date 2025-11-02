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
    loadWorkoutPlan();
  }, [user?.uid]);

  // Sincronizează zilele din context cu state-ul local
  useEffect(() => {
    if (workoutPlan?.days) {
      setDays(workoutPlan.days);
    }
  }, [workoutPlan?.days]);

  const loadWorkoutPlan = async () => {
    console.log("[WorkoutPlanScreen] loadWorkoutPlan for user:", user?.uid);
    if (!user?.uid) return;

    const result = await getUserWorkoutPlan(user.uid);
    if (result.success && result.data) {
      // Plan existent în Firebase
      setExistingPlanId(result.data.id || null);
      if (result.data.planName && (!planName || planName === "")) {
        setPlanName(result.data.planName);
      }
      setDays(result.data.days);
    } else {
      // Nu există plan în Firebase
      setExistingPlanId(null);
    }
    setLoading(false);
  };

  const handleDayPress = (day: string) => {
    router.push({
      pathname: "/(modals)/dayWorkout",
      params: { day, planId: existingPlanId || "new" },
    });
  };

  const getDayStatus = (day: string) => {
    const dayData = days.find((d) => d.day === day);
    if (!dayData) return null;

    if (dayData.isRestDay) return "rest";
    if (dayData.exercises.length > 0) return "active";
    return null;
  };

  const handleSave = async () => {
    console.log("[WorkoutPlanScreen] handleSave planName:", planName, "existingPlanId:", existingPlanId);

    if (!planName.trim()) {
      Alert.alert("Error", "Please add a name for your workout plan");
      return;
    }

    if (!user?.uid) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

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

    console.log("[WorkoutPlanScreen] save result:", result);
    setSaving(false);

    if (result.success) {
      if (!existingPlanId && result.data?.id) {
        // Plan nou creat - setează ID-ul
        setExistingPlanId(result.data.id);
      }
      
      await refreshPlan();
      
      Alert.alert("Success", "Workout plan saved successfully!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } else {
      Alert.alert("Error", result.msg || "Could not save workout plan");
    }
  };

  const handleDelete = () => {
    if (!existingPlanId) {
      Alert.alert("Info", "No plan to delete");
      return;
    }

    Alert.alert(
      "Delete Workout Plan",
      "Are you sure you want to delete this workout plan? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: performDelete,
        },
      ]
    );
  };

  const performDelete = async () => {
    setDeleting(true);
    const result = await deletePlan();
    setDeleting(false);

    if (result.success) {
      Alert.alert("Success", "Workout plan deleted successfully!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } else {
      Alert.alert("Error", result.msg || "Could not delete workout plan");
    }
  };

  if (loading) {
    return (
      <ModalWrapper>
        <View style={styles.container}>
          <Header
            title="Workout Plan"
            leftIcon={<BackButton />}
            style={{ marginBottom: spacingY._15 }}
          />
        </View>
        <Loading />
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title="Workout Plan"
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._15 }}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputContainer}>
            <Input
              placeholder="ex. Push/Pull/Legs"
              value={planName}
              onChangeText={setPlanName}
              containerStyle={styles.input}
            />
            <Typo size={13} color={colors.neutral400} style={{ marginTop: spacingY._7 }}>
              Add a name for your Workout Plan
            </Typo>
          </View>

          <View style={styles.daysContainer}>
            {DAYS_OF_WEEK.map((day) => {
              const status = getDayStatus(day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayCard,
                    status === "rest" && styles.dayCardRest,
                    status === "active" && styles.dayCardActive,
                  ]}
                  onPress={() => handleDayPress(day)}
                  activeOpacity={0.7}
                >
                  <Typo
                    size={18}
                    fontWeight="600"
                    color={status === "rest" ? colors.neutral500 : colors.white}
                  >
                    {day}
                  </Typo>
                  <Icons.PencilIcon
                    size={20}
                    color={status === "rest" ? colors.neutral500 : colors.primary}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Afișează butonul DELETE doar dacă planul există în Firebase */}
          {existingPlanId && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={deleting}
            >
              <Icons.TrashIcon size={20} color={colors.rose} />
              <Typo size={16} fontWeight="600" color={colors.rose}>
                {deleting ? "Deleting..." : "Delete Workout Plan"}
              </Typo>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={[styles.footerSticky, { bottom: insets.bottom + 12 }]}>
          <Button onPress={handleSave} loading={saving} style={{ flex: 1 }}>
            <Typo color={colors.black} fontWeight="700" size={18}>
              Save Workout Plan
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
    paddingBottom: verticalScale(220),
  },
  inputContainer: {
    marginBottom: spacingY._25,
  },
  input: {
    backgroundColor: colors.neutral700,
  },
  daysContainer: {
    gap: spacingY._12,
  },
  dayCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    padding: spacingX._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  dayCardRest: {
    backgroundColor: colors.neutral700,
    opacity: 0.6,
  },
  dayCardActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._10,
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingY._15,
    borderWidth: 1,
    borderColor: colors.rose,
    marginTop: spacingY._20,
  },
  footerSticky: {
    position: "absolute",
    left: spacingX._20,
    right: spacingX._20,
    zIndex: 30,
  },
});