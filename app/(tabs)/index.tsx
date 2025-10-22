import { colors, spacingX, spacingY } from "@/constants/theme";
import ScreenWrapper from "@/src/components/layout/ScreenWrapper";
import HistoryCard from "@/src/components/ui/HistoryCard";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { verticalScale } from "@/src/utils/styling";
import * as React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

const Home = () => {
  const { user } = useAuth();

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* header */}
        <View style={styles.header}>
          <View style={{ gap: 4 }}>
            <Typo size={16} color={colors.neutral400}>
              Welcome back,
            </Typo>
            <Typo size={20} fontWeight="500">
              {user?.name}
            </Typo>
          </View>
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollViewStyle}
          showsVerticalScrollIndicator={false}
        >
          {/* card */}
          <View>
            <HistoryCard />
          </View>
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
    marginTop: verticalScale(8),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._10,
  },
  searchIcon: {
    backgroundColor: colors.neutral700,
    padding: spacingX._10,
    borderRadius: 50,
  },
  floatingButton: {
    height: verticalScale(50),
    width: verticalScale(50),
    borderRadius: 100,
    position: "absolute",
    bottom: verticalScale(30),
    right: verticalScale(30),
  },
  scrollViewStyle: {
    marginTop: spacingY._10,
    paddingBottom: verticalScale(100),
    gap: spacingY._25,
  },
});