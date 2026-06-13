import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  CheckCircle,
  TrendUp,
  TrendDown,
  Fire,
  ArrowRight,
} from "phosphor-react-native";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import useReduceMotion from "@/src/hooks/useReduceMotion";
import { verticalScale, scale } from "@/src/utils/styling";
import Typo from "@/src/components/ui/Typo";
import { MaintenanceAnalysisResult, MaintenanceStatus } from "@/src/types/maintenance";
import { useLanguage } from "@/src/contexts/languageContext";

type MaintenanceAnalysisProps = {
  analysis: MaintenanceAnalysisResult;
};

const getStatusConfig = (
  status: MaintenanceStatus
): {
  icon: React.ReactNode;
  color: string;
  backgroundColor: string;
  emoji: string;
} => {
  switch (status) {
    case "maintenance":
      return {
        icon: <CheckCircle size={verticalScale(24)} color={colors.success} weight="fill" />,
        color: colors.success,
        backgroundColor: "rgba(22, 163, 74, 0.15)",
        emoji: "🟢",
      };
    case "surplus":
      return {
        icon: <TrendUp size={verticalScale(24)} color={colors.danger} weight="bold" />,
        color: colors.danger,
        backgroundColor: "rgba(220, 38, 38, 0.15)",
        emoji: "🔴",
      };
    case "deficit":
      return {
        icon: <TrendDown size={verticalScale(24)} color={colors.primary} weight="bold" />,
        color: colors.primary,
        backgroundColor: "rgba(0, 119, 188, 0.15)",
        emoji: "🔵",
      };
  }
};

const MaintenanceAnalysis = ({ analysis }: MaintenanceAnalysisProps) => {
  const { t } = useLanguage();
  const statusConfig = getStatusConfig(analysis.status);
  const reduceMotion = useReduceMotion();

  const differenceText =
    analysis.difference >= 0 ? `+${analysis.difference}` : `${analysis.difference}`;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(200).springify()}
      style={styles.container}
    >
      <View style={styles.header}>
        <Typo size={verticalScale(16)} fontWeight="700" color={colors.text}>
          {t("maintenance_analysis_title")}
        </Typo>
      </View>

      {/* Status Badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusConfig.backgroundColor }]}>
        {statusConfig.icon}
        <View style={styles.statusTextContainer}>
          <Typo
            size={verticalScale(16)}
            fontWeight="700"
            color={statusConfig.color}
          >
            {analysis.statusLabel}
          </Typo>
        </View>
      </View>

      {/* Week Comparison */}
      <View style={styles.comparisonContainer}>
        <View style={styles.weekBox}>
          <Typo size={verticalScale(11)} fontWeight="600" color={colors.textMuted}>
            {t("maintenance_analysis_week1")}
          </Typo>
          <Typo size={verticalScale(20)} fontWeight="700" color={colors.text}>
            {analysis.week1Average.toFixed(1)}
          </Typo>
          <Typo size={verticalScale(11)} color={colors.textMuted}>
            kg
          </Typo>
        </View>

        <View style={styles.arrowContainer}>
          <ArrowRight size={verticalScale(20)} color={colors.textMuted} />
          <Typo
            size={verticalScale(14)}
            fontWeight="700"
            color={statusConfig.color}
          >
            {differenceText} kg
          </Typo>
        </View>

        <View style={styles.weekBox}>
          <Typo size={verticalScale(11)} fontWeight="600" color={colors.textMuted}>
            {t("maintenance_analysis_week2")}
          </Typo>
          <Typo size={verticalScale(20)} fontWeight="700" color={colors.text}>
            {analysis.week2Average.toFixed(1)}
          </Typo>
          <Typo size={verticalScale(11)} color={colors.textMuted}>
            kg
          </Typo>
        </View>
      </View>

      {/* Estimated Maintenance (if available) */}
      {analysis.estimatedMaintenance && (
        <View style={styles.maintenanceEstimate}>
          <View style={styles.estimateHeader}>
            <Fire size={verticalScale(18)} color={colors.warning} weight="fill" />
            <Typo size={verticalScale(13)} fontWeight="600" color={colors.text}>
              {t("maintenance_analysis_estimated")}
            </Typo>
          </View>
          <View style={styles.estimateValue}>
            <Typo size={verticalScale(24)} fontWeight="700" color={colors.warning}>
              {analysis.estimatedMaintenance.toLocaleString()}
            </Typo>
            <Typo size={verticalScale(14)} color={colors.textMuted}>
              {" "}{t("maintenance_analysis_kcal_day")}
            </Typo>
          </View>
          <Typo
            size={verticalScale(11)}
            color={colors.textMuted}
            style={styles.estimateNote}
          >
            {t("maintenance_analysis_calculated_desc")}
          </Typo>
        </View>
      )}

      {/* Interpretation Help */}
      <View style={styles.helpContainer}>
        <Typo size={verticalScale(12)} color={colors.textMuted} style={styles.helpText}>
          {analysis.status === "maintenance" && t("maintenance_analysis_desc_maintenance")}
          {analysis.status === "surplus" && t("maintenance_analysis_desc_surplus")}
          {analysis.status === "deficit" && t("maintenance_analysis_desc_deficit")}
        </Typo>
      </View>
    </Animated.View>
  );
};

export default MaintenanceAnalysis;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius._15,
    padding: spacingX._15,
    marginHorizontal: spacingX._15,
    marginBottom: spacingY._20,
  },
  header: {
    marginBottom: spacingY._15,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacingX._15,
    borderRadius: radius._10,
    gap: scale(12),
    marginBottom: spacingY._15,
  },
  statusTextContainer: {
    flex: 1,
  },
  comparisonContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceMid,
    borderRadius: radius._10,
    padding: spacingX._15,
    marginBottom: spacingY._15,
  },
  weekBox: {
    alignItems: "center",
    flex: 1,
  },
  arrowContainer: {
    alignItems: "center",
    paddingHorizontal: spacingX._10,
  },
  maintenanceEstimate: {
    backgroundColor: "rgba(217, 119, 6, 0.1)",
    borderRadius: radius._10,
    padding: spacingX._15,
    marginBottom: spacingY._10,
  },
  estimateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    marginBottom: spacingY._5,
  },
  estimateValue: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  estimateNote: {
    marginTop: spacingY._5,
  },
  helpContainer: {
    paddingTop: spacingY._10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMid,
  },
  helpText: {
    textAlign: "center",
    lineHeight: verticalScale(18),
  },
});
