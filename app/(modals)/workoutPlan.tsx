import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Loading from "@/src/components/ui/Loading";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import {
    createWorkoutPlan,
    getUserWorkoutPlan,
    updateWorkoutPlan
} from "@/src/services/workoutPlanService";
import { DayWorkout, WorkoutPlan } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from "react-native";

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
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planName, setPlanName] = useState("");
  const [existingPlan, setExistingPlan] = useState<WorkoutPlan | null>(null);
  const [days, setDays] = useState<DayWorkout[]>(
    DAYS_OF_WEEK.map((day) => ({
      day,
      isRestDay: false,
      exercises: [],
    }))
  );

  useEffect(() => {
    loadWorkoutPlan();
  }, [user?.uid]);

  const loadWorkoutPlan = async () => {
    if (!user?.uid) return;

    const result = await getUserWorkoutPlan(user.uid);
    if (result.success && result.data) {
      setExistingPlan(result.data);
      setPlanName(result.data.planName);
      setDays(result.data.days);
    }
    setLoading(false);
  };

  const handleDayPress = (day: string) => {
    router.push({
      pathname: "/(modals)/dayWorkout",
      params: { day, planId: existingPlan?.id || "new" },
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
      createdAt: existingPlan?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    let result;
    if (existingPlan?.id) {
      result = await updateWorkoutPlan(existingPlan.id, planData);
    } else {
      result = await createWorkoutPlan(planData);
    }

    setSaving(false);

    if (result.success) {
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
          {/* Plan Name Input */}
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

          {/* Days of Week */}
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
                  <Icons.PlusCircleIcon
                    size={24}
                    color={status === "rest" ? colors.neutral500 : colors.primary}
                    weight="fill"
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Footer - Save Button */}
        <View style={styles.footer}>
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
    paddingBottom: verticalScale(20),
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
  footer: {
    paddingTop: spacingY._15,
    borderTopWidth: 1,
    borderTopColor: colors.neutral700,
    marginBottom: spacingY._5,
  },
});