import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Loading from "@/src/components/ui/Loading";
import Typo from "@/src/components/ui/Typo";
import { deleteWorkout, getWorkout } from "@/src/services/workoutService";
import { WorkoutHistory } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { formatDuration } from "@/src/utils/utils";
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

const WorkoutDetail = () => {
  const { workoutId } = useLocalSearchParams();
  const [workout, setWorkout] = useState<WorkoutHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchWorkoutDetails();
  }, [workoutId]);

  const fetchWorkoutDetails = async () => {
    if (!workoutId) return;

    const result = await getWorkout(workoutId as string);
    if (result.success) {
      setWorkout(result.data);
    } else {
      Alert.alert("Error", result.msg || "Could not load workout details");
    }
    setIsLoading(false);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Workout",
      "Are you sure you want to delete this workout?",
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
    if (!workoutId) return;
    
    setIsLoading(true);
    const result = await deleteWorkout(workoutId as string);
    setIsLoading(false);
    
    if (result.success) {
      router.push({
        pathname: "/(tabs)/history",
        params: { refresh: "true" },
      });
    } else {
      Alert.alert("Error", result.msg || "Could not delete workout");
    }
  };

  const formatDate = (date: Date | string) => {
    const workoutDate = new Date(date);
    return workoutDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <ModalWrapper>
        <View style={styles.container}>
          <Header
            title="Workout Details"
            leftIcon={<BackButton />}
            style={{ marginBottom: spacingY._20 }}
          />
        </View>
        <Loading />
      </ModalWrapper>
    );
  }

  if (!workout) {
    return (
      <ModalWrapper>
        <View style={styles.container}>
          <Header
            title="Workout Details"
            leftIcon={<BackButton />}
            style={{ marginBottom: spacingY._20 }}
          />
          <Typo>Workout not found</Typo>
        </View>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._20 }}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Date & Duration Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Icons.CalendarIcon size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Typo size={13} color={colors.neutral400}>
                  Date
                </Typo>
                <Typo size={16} fontWeight="500">
                  {formatDate(workout.date)}
                </Typo>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Icons.TimerIcon size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Typo size={13} color={colors.neutral400}>
                  Duration
                </Typo>
                <Typo size={16} fontWeight="500">
                  {formatDuration(workout.duration)}
                </Typo>
              </View>
            </View>
          </View>

          {/* Exercises */}
          <View style={styles.section}>
            <Typo size={20} fontWeight="600" style={{ marginBottom: spacingY._15 }}>
              Exercises ({workout.exercises?.length || 0})
            </Typo>

            {workout.exercises?.map((exercise, index) => (
              <View key={index} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <Typo size={17} fontWeight="600">
                    {exercise.exerciseName}
                  </Typo>
                  <View style={styles.setsBadge}>
                    <Typo size={13} color={colors.white}>
                      {exercise.sets.length} sets
                    </Typo>
                  </View>
                </View>

                {/* Sets */}
                <View style={styles.setsContainer}>
                  {exercise.sets.map((set, setIndex) => (
                    <View key={setIndex} style={styles.setRow}>
                      <View style={styles.setNumber}>
                        <Typo size={13} color={colors.neutral400}>
                          Set {setIndex + 1}
                        </Typo>
                      </View>
                      <View style={styles.setDetails}>
                        <View style={styles.setInfo}>
                          <Typo size={15} fontWeight="500">
                            {set.weight} {set.weightUnit}
                          </Typo>
                          <Typo size={13} color={colors.neutral400}>
                            × {set.reps} reps
                          </Typo>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* Delete Button */}
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Icons.TrashIcon size={20} color={colors.rose} />
            <Typo size={16} fontWeight="600" color={colors.rose}>
              Delete Workout
            </Typo>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </ModalWrapper>
  );
};

export default WorkoutDetail;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  scrollContent: {
    paddingBottom: verticalScale(40),
    gap: spacingY._20,
  },
  infoCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._15,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral700,
    marginVertical: spacingY._15,
  },
  section: {
    gap: spacingY._10,
  },
  exerciseCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    marginBottom: spacingY._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._15,
  },
  setsBadge: {
    backgroundColor: colors.neutral700,
    paddingHorizontal: spacingX._12,
    paddingVertical: verticalScale(4),
    borderRadius: radius._10,
  },
  setsContainer: {
    gap: spacingY._10,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._15,
  },
  setNumber: {
    width: verticalScale(50),
  },
  setDetails: {
    flex: 1,
    backgroundColor: colors.neutral700,
    borderRadius: radius._12,
    padding: spacingX._15,
  },
  setInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    marginTop: spacingY._10,
  },
});