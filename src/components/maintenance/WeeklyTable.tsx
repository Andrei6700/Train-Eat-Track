import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { verticalScale, scale } from "@/src/utils/styling";
import Typo from "@/src/components/ui/Typo";
import { WeeklyData } from "@/src/types/maintenance";
import { generateWeekDays, parseDateKey } from "@/src/services/maintenanceService";
import { useLanguage } from "@/src/contexts/languageContext";
import { WEEK_DAY_SHORT_NAMES, AppLanguage } from "@/src/i18n/translations";

type WeeklyTableProps = {
  weeks: WeeklyData[];
  style?: ViewStyle;
};

const formatShortDate = (dateKey: string, language: AppLanguage): string => {
  const [_year, month, day] = dateKey.split("-").map(Number);
  const monthNamesRo = [
    "Ian", "Feb", "Mar", "Apr", "Mai", "Iun",
    "Iul", "Aug", "Sep", "Oct", "Noi", "Dec",
  ];
  const monthNamesEn = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthNames = language === "ro" ? monthNamesRo : monthNamesEn;
  return `${day} ${monthNames[month - 1]}`;
};

const getShortDayName = (dayOfWeek: number, language: AppLanguage): string => {
  const adjustedIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return WEEK_DAY_SHORT_NAMES[language][adjustedIndex];
};

const WeeklyTable = ({ weeks, style }: WeeklyTableProps) => {
  const { language, t } = useLanguage();

  if (weeks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Typo size={verticalScale(14)} color={colors.textMuted} style={styles.emptyText}>
          {t("maintenance_table_empty")}
        </Typo>
      </View>
    );
  }

  // Reverse weeks to show most recent first
  const reversedWeeks = [...weeks].reverse();

  return (
    <View style={[styles.container, style]}>
      {/* Table Header */}
      <View style={styles.tableHeader}>
        <View style={[styles.headerCell, styles.dayColumn]}>
          <Typo size={verticalScale(12)} fontWeight="700" color={colors.textMuted}>
            {t("maintenance_table_header_day")}
          </Typo>
        </View>
        <View style={[styles.headerCell, styles.dateColumn]}>
          <Typo size={verticalScale(12)} fontWeight="700" color={colors.textMuted}>
            {t("maintenance_table_header_date")}
          </Typo>
        </View>
        <View style={[styles.headerCell, styles.weightColumn]}>
          <Typo size={verticalScale(12)} fontWeight="700" color={colors.textMuted}>
            {t("maintenance_table_header_weight")}
          </Typo>
        </View>
      </View>

      {/* Weeks */}
      {reversedWeeks.map((week) => {
        const weekStartDate = parseDateKey(week.startDate);
        const weekDays = generateWeekDays(weekStartDate, week.entries);

        return (
          <View key={week.startDate} style={styles.weekContainer}>
            {/* Week Label */}
            <View style={styles.weekLabel}>
              <Typo size={verticalScale(11)} fontWeight="600" color={colors.primary}>
                {t("maintenance_table_week_label", { count: week.weekNumber })}
              </Typo>
            </View>

            {/* Days */}
            {weekDays.map((day, index) => {
              const isEven = index % 2 === 0;
              const hasEntry = day.entry !== null;

              return (
                <View
                  key={day.date}
                  style={[
                    styles.tableRow,
                    isEven ? styles.rowEven : styles.rowOdd,
                  ]}
                >
                  <View style={[styles.cell, styles.dayColumn]}>
                    <Typo
                      size={verticalScale(13)}
                      fontWeight="500"
                      color={hasEntry ? colors.text : colors.textMuted}
                    >
                      {getShortDayName(day.dayOfWeek, language)}
                    </Typo>
                  </View>
                  <View style={[styles.cell, styles.dateColumn]}>
                    <Typo
                      size={verticalScale(13)}
                      color={hasEntry ? colors.text : colors.textMuted}
                    >
                      {formatShortDate(day.date, language)}
                    </Typo>
                  </View>
                  <View style={[styles.cell, styles.weightColumn]}>
                    <Typo
                      size={verticalScale(13)}
                      fontWeight={hasEntry ? "600" : "400"}
                      color={hasEntry ? colors.text : colors.surfaceMid}
                    >
                      {hasEntry ? day.entry!.weight.toFixed(1) : "—"}
                    </Typo>
                  </View>
                </View>
              );
            })}

            {/* Week Average Row */}
            <View style={styles.averageRow}>
              <View style={[styles.cell, styles.dayColumn]}>
                <Typo size={verticalScale(13)} fontWeight="700" color={colors.primary}>
                  {t("maintenance_table_average")}
                </Typo>
              </View>
              <View style={[styles.cell, styles.dateColumn]}>
                <Typo size={verticalScale(12)} fontWeight="600" color={colors.primary}>
                  {t("maintenance_table_week_short", { count: week.weekNumber })}
                </Typo>
              </View>
              <View style={[styles.cell, styles.weightColumn]}>
                <Typo size={verticalScale(14)} fontWeight="700" color={colors.primary}>
                  {week.average !== null ? week.average.toFixed(1) : "—"}
                </Typo>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default WeeklyTable;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacingX._15,
    paddingBottom: spacingY._30,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacingX._20,
  },
  emptyText: {
    textAlign: "center",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMid,
    borderTopLeftRadius: radius._10,
    borderTopRightRadius: radius._10,
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._10,
    marginBottom: 1,
  },
  headerCell: {
    justifyContent: "center",
  },
  weekContainer: {
    marginBottom: spacingY._20,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius._10,
    overflow: "hidden",
  },
  weekLabel: {
    backgroundColor: "rgba(0, 119, 188, 0.1)",
    paddingVertical: spacingY._5,
    paddingHorizontal: spacingX._10,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: spacingY._10,
    paddingHorizontal: spacingX._10,
  },
  rowEven: {
    backgroundColor: colors.surfaceCard,
  },
  rowOdd: {
    backgroundColor: "rgba(44, 44, 46, 0.5)",
  },
  cell: {
    justifyContent: "center",
  },
  dayColumn: {
    flex: 1,
    minWidth: scale(50),
  },
  dateColumn: {
    flex: 1.5,
    minWidth: scale(70),
  },
  weightColumn: {
    flex: 1.5,
    minWidth: scale(80),
    alignItems: "flex-end",
    paddingRight: spacingX._10,
  },
  averageRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 119, 188, 0.15)",
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._10,
    borderBottomLeftRadius: radius._10,
    borderBottomRightRadius: radius._10,
  },
});
