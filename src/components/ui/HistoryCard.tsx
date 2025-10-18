import { colors, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/src/utils/styling";
import React from "react";
import { ImageBackground, StyleSheet, View } from "react-native";
import Typo from "./Typo";

const HistoryCard = () => {
  return (
    <ImageBackground
      source={require("@/assets/images/card.png")}
      resizeMode="stretch"
      style={styles.bgImage}
    >
      <View style={styles.container}>
        <View>
          {/* Header */}
          <View style={styles.totalBalanceRow}>
            <Typo color={colors.neutral800} size={17} fontWeight="700">
              Your Fitness Stats
            </Typo>
          </View>
          
          {/* Main Stats Row */}
          <View style={styles.mainStatsRow}>
            {/* Total Workouts */}
            <View style={styles.statItem}>
              <Typo color={"#3B33C4"} size={30} fontWeight="bold" >
                2
              </Typo>
              <Typo color={colors.neutral700} size={14} fontWeight="400" style={styles.labelText}>
                Total{"\n"}Workouts
              </Typo>
            </View>

            {/* Total Time */}
            <View style={styles.statItem}>
              <Typo color={colors.green} size={30} fontWeight="bold">
                33m 21s
              </Typo>
              <Typo color={colors.neutral700} size={14} fontWeight="400" style={styles.labelText}>
                Total{"\n"}Time
              </Typo>
            </View>

            {/* Days Active */}
            <View style={styles.statItem}>
              <Typo color={"#B413BF"} size={30} fontWeight="bold">
                5
              </Typo>
              <Typo color={colors.neutral700} size={14} fontWeight="400" style={styles.labelText}>
                Days{"\n"}Active
              </Typo>
            </View>
          </View>
        </View>

        {/* Average Workout Duration */}
                <View style={styles.averageSection}>
          <View style={styles.divider} />
        <View style={styles.averageRow}>
          <Typo color={colors.neutral700} size={14} fontWeight="400">
            Average workout duration:
          </Typo>
          <Typo color={colors.black} size={16} fontWeight="600">
            16m 41s
          </Typo>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
};

export default HistoryCard;

const styles = StyleSheet.create({
  bgImage: {
    width: "100%",
    height: scale(210),
  },
  container: {
    padding: spacingX._20,
    paddingHorizontal: scale(23),
    height: "87%",
    width: "100%",
    justifyContent: "space-between",
  },
  totalBalanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._10,
  },
  mainStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  statItem: {
    alignItems: "center",
    gap: verticalScale(5),
  },
  averageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral400,
    width: "100%",
    opacity: 0.3,
  },
    averageSection: {
    gap: verticalScale(12),
  },
    labelText: {
    textAlign: "center",
    lineHeight: 16,
  },
});