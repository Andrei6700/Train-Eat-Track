import React, { useState, useCallback } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import {
  Calendar,
  CalendarIcon,
  FloppyDisk,
  Fire,
} from "phosphor-react-native";
import { Calendar as RNCalendar, DateData } from "react-native-calendars";
import { colors, radi, WEEK_DAYS_RO us, spacingX, spacingY } from "@/constants/theme";
import { verticalScale, scale } from "@/src/utils/styling";

import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import { WeightEntry } from "@/src/types/maintenance";
import { formatDateKey } from "@/src/services/maintenanceService";
import { WEEK_DAYS_RO } from "@/src/types/maintenance";

type WeightEntryFormProps = {
  onSave: (entry: WeightEntry) => Promise<void>;
  loading?: boolean;
  existingEntry?: WeightEntry | null;
};

const WeightEntryForm = ({
  onSave,
  loading = false,
  existingEntry,
}: WeightEntryFormProps) => {
  const today = formatDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(
    existingEntry?.date || today,
  );
  const [weight, setWeight] = useState(existingEntry?.weight?.toString() || "");
  const [calories, setCalories] = useState(
    existingEntry?.calories?.toString() || "",
  );
  const [showCalendar, setShowCalendar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDisplayDate = (dateKey: string): string => {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const dayName = WEEK_DAYS_RO[date.getDay()];
    const monthNames = [
      "Ian",
      "Feb",
      "Mar",
      "Apr",
      "Mai",
      "Iun",
      "Iul",
      "Aug",
      "Sep",
      "Oct",
      "Noi",
      "Dec",
    ];
    return `${dayName}, ${day} ${monthNames[month - 1]} ${year}`;
  };

  const handleDateSelect = useCallback((day: DateData) => {
    setSelectedDate(day.dateString);
    setShowCalendar(false);
  }, []);

  const handleWeightChange = useCallback((text: string) => {
    // Allow only numbers and one decimal point
    const filtered = text.replace(/[^0-9.]/g, "");
    const parts = filtered.split(".");
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 1) return;
    setWeight(filtered);
    setError(null);
  }, []);

  const handleCaloriesChange = useCallback((text: string) => {
    // Allow only integers
    const filtered = text.replace(/[^0-9]/g, "");
    setCalories(filtered);
  }, []);

  const handleSave = useCallback(async () => {
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0 || weightNum > 500) {
      setError("Introdu o greutate validă (1-500 kg)");
      return;
    }

    const caloriesNum = calories ? parseInt(calories, 10) : undefined;

    await onSave({
      date: selectedDate,
      weight: weightNum,
      calories: caloriesNum,
    });

    // Reset form after successful save
    setSelectedDate(today);
    setWeight("");
    setCalories("");
  }, [weight, calories, selectedDate, onSave, today]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Date Picker */}
        <View style={styles.fieldContainer}>
          <Typo
            size={verticalScale(14)}
            fontWeight="600"
            color={colors.textMuted}
            style={styles.label}
          >
            Data
          </Typo>
          <Pressable
            style={styles.dateButton}
            onPress={() => setShowCalendar(true)}
          >
            <CalendarIcon size={verticalScale(20)} color={colors.primary} />
            <Typo size={verticalScale(16)} color={colors.text}>
              {formatDisplayDate(selectedDate)}
            </Typo>
          </Pressable>
        </View>

        {/* Weight Input */}
        <View style={styles.fieldContainer}>
          <Typo
            size={verticalScale(14)}
            fontWeight="600"
            color={colors.textMuted}
            style={styles.label}
          >
            Greutate (kg)
          </Typo>
          <Input
            value={weight}
            onChangeText={handleWeightChange}
            placeholder="ex: 82.4"
            keyboardType="decimal-pad"
            hasError={!!error}
          />
          {error && (
            <Typo
              size={verticalScale(12)}
              color={colors.danger}
              style={styles.errorText}
            >
              {error}
            </Typo>
          )}
        </View>

        {/* Calories Input (Optional) */}
        <View style={styles.fieldContainer}>
          <View style={styles.labelRow}>
            <Typo
              size={verticalScale(14)}
              fontWeight="600"
              color={colors.textMuted}
            >
              Calorii consumate (opțional)
            </Typo>
            <Fire size={verticalScale(16)} color={colors.warning} />
          </View>
          <Input
            value={calories}
            onChangeText={handleCaloriesChange}
            placeholder="ex: 2200"
            keyboardType="number-pad"
          />
          <Typo
            size={verticalScale(12)}
            color={colors.textMuted}
            style={styles.helperText}
          >
            Adaugă caloriile pentru estimarea mentenanței
          </Typo>
        </View>

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          <Button onPress={handleSave} loading={loading} disabled={!weight}>
            <View style={styles.buttonContent}>
              <FloppyDisk size={verticalScale(20)} color={colors.black} />
              <Typo
                size={verticalScale(16)}
                fontWeight="700"
                color={colors.black}
              >
                Salvează
              </Typo>
            </View>
          </Button>
        </View>
      </ScrollView>

      {/* Calendar Modal */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowCalendar(false)}
        >
          <View style={styles.calendarContainer}>
            <RNCalendar
              current={selectedDate}
              maxDate={today}
              onDayPress={handleDateSelect}
              markedDates={{
                [selectedDate]: {
                  selected: true,
                  selectedColor: colors.primary,
                },
              }}
              theme={{
                backgroundColor: colors.surfaceCard,
                calendarBackground: colors.surfaceCard,
                textSectionTitleColor: colors.textMuted,
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: colors.white,
                todayTextColor: colors.primary,
                dayTextColor: colors.text,
                textDisabledColor: colors.surfaceMid,
                arrowColor: colors.primary,
                monthTextColor: colors.text,
                textDayFontWeight: "400",
                textMonthFontWeight: "700",
                textDayHeaderFontWeight: "600",
              }}
              style={styles.calendar}
            />
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default WeightEntryForm;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacingX._20,
    paddingBottom: spacingY._30,
  },
  fieldContainer: {
    marginBottom: spacingY._20,
  },
  label: {
    marginBottom: spacingY._10,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    marginBottom: spacingY._10,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
    backgroundColor: colors.surfaceMid,
    borderRadius: radius._10,
    paddingHorizontal: spacingX._15,
    paddingVertical: spacingY._15,
  },
  errorText: {
    marginTop: spacingY._5,
  },
  helperText: {
    marginTop: spacingY._5,
  },
  buttonContainer: {
    marginTop: spacingY._10,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacingX._20,
  },
  calendarContainer: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius._15,
    overflow: "hidden",
    width: "100%",
    maxWidth: 400,
  },
  calendar: {
    borderRadius: radius._15,
  },
});
