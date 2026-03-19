import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Loading from "@/src/components/ui/Loading";
import Typo from "@/src/components/ui/Typo";
import { useLanguage } from "@/src/contexts/languageContext";
import { LOCALE_BY_LANGUAGE } from "@/src/i18n/translations";
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
  const { language, t } = useLanguage();

  useEffect(() => {
    fetchWorkoutDetails();
  }, [workoutId]);

  const fetchWorkoutDetails = async () => {
    if (!workoutId) return;

    const result = await getWorkout(workoutId as string);
    if (result.success) {
      setWorkout(result.data);
    } else {
      Alert.alert(
        t("common_error"),
        result.msg || t("workout_detail_modal_error_load"),
      );
    }
    setIsLoading(false);
  };

  const handleDelete = () => {
    Alert.alert(
      t("workout_detail_modal_delete_title"),
      t("workout_detail_modal_delete_message"),
      [
        {
          text: t("common_cancel"),
          style: "cancel",
        },
        {
          text: t("common_delete"),
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
      Alert.alert(
        t("common_error"),
        result.msg || t("workout_detail_modal_error_delete"),
      );
    }
  };

  const formatDate = (date: Date | string) => {
    const workoutDate = new Date(date);
    return workoutDate.toLocaleDateString(LOCALE_BY_LANGUAGE[language], {
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
            title={t("workout_detail_modal_title")}
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
            title={t("workout_detail_modal_title")}
            leftIcon={<BackButton />}
            style={{ marginBottom: spacingY._20 }}
          />
          <Typo>{t("workout_detail_modal_not_found")}</Typo>
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
                  {t("workout_detail_modal_date")}
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
                  {t("workout_detail_modal_duration")}
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
              {t("workout_detail_modal_exercises_count", {
                count: workout.exercises?.length || 0,
              })}
            </Typo>

            {workout.exercises?.map((exercise, index) => (
              <View key={index} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <Typo size={17} fontWeight="600">
                    {exercise.exerciseName}
                  </Typo>
                  <View style={styles.setsBadge}>
                    <Typo size={13} color={colors.white}>
                      {t("workout_detail_modal_sets_badge", {
                        count: exercise.sets.length,
                      })}
                    </Typo>
                  </View>
                </View>

                {/* Sets */}
                <View style={styles.setsContainer}>
                  {exercise.sets.map((set, setIndex) => (
                    <View key={setIndex} style={styles.setRow}>
                      <View style={styles.setNumber}>
                        <Typo size={13} color={colors.neutral400}>
                          {t("workout_detail_modal_set_label", {
                            index: setIndex + 1,
                          })}
                        </Typo>
                      </View>
                      <View style={styles.setDetails}>
                        <View style={styles.setInfo}>
                          <Typo size={15} fontWeight="500">
                            {set.weight} {set.weightUnit}
                          </Typo>
                          <Typo size={13} color={colors.neutral400}>
                            x {t("workout_detail_modal_reps_count", { count: set.reps })}
                          </Typo>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.deleteActionWrap}>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Icons.TrashIcon size={20} color={colors.rose} />
              <Typo size={16} fontWeight="600" color={colors.rose}>
                {t("workout_detail_modal_delete_title")}
              </Typo>
            </TouchableOpacity>
          </View>
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
    paddingBottom: verticalScale(72),
    gap: spacingY._20,
  },
  infoCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    borderWidth: 2,
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
    borderWidth: 2,
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
  deleteActionWrap: {
    alignItems: "center",
    marginTop: spacingY._15,
    marginBottom: spacingY._15,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._10,
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingY._15,
    borderWidth: 2,
    borderColor: colors.rose,
    width: "92%",
  },
});

