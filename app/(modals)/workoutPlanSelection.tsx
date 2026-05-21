import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Header from "@/src/components/layout/Header";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Typo from "@/src/components/ui/Typo";
import { useWorkoutPlan } from "@/src/contexts/workoutPlanContext";
import {
  WORKOUT_TEMPLATES,
  getTemplateById,
} from "@/src/data/workoutTemplates";
import { importWorkoutPlanFromExcel } from "@/src/services/workoutPlanImportService";
import { WorkoutTemplate } from "@/src/types";
import { verticalScale } from "@/src/utils/styling";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const WorkoutPlanSelectionScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setPlanDraft } = useWorkoutPlan();

  const [view, setView] = useState<"main" | "templates">("main");
  const [importing, setImporting] = useState(false);

  const totalTemplateExercises = WORKOUT_TEMPLATES.reduce(
    (total, template) =>
      total +
      template.days.reduce((dayTotal, day) => dayTotal + day.exercises.length, 0),
    0,
  );

  const handleTemplateSelect = (templateId: string) => {
    const template = getTemplateById(templateId);
    if (template) {
      router.push({
        pathname: "/(modals)/workoutPlan",
        params: { templateId },
      });
    }
  };

  const handleImportExcel = async () => {
    setImporting(true);
    try {
      const result = await importWorkoutPlanFromExcel();
      if (result.success && result.data) {
        setPlanDraft({
          userID: "",
          planName: result.data.planName || "Imported Plan",
          splitDays: result.data.splitDays,
          days: result.data.days,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        router.push({
          pathname: "/(modals)/workoutPlan",
          params: { fromImport: "true" },
        });
      }
    } catch (error) {
      console.error("Import failed:", error);
    } finally {
      setImporting(false);
    }
  };

  const handleCustomPlan = () => {
    router.push("/(modals)/workoutPlan");
  };

  const handleShowTemplates = () => {
    setView("templates");
  };

  const handleBackToMain = () => {
    setView("main");
  };

  const TemplateCard = ({
    template,
    index,
  }: {
    template: WorkoutTemplate;
    index: number;
  }) => {
    const exerciseCount = template.days.reduce(
      (acc, day) => acc + day.exercises.length,
      0,
    );
    const workoutDays = template.days.filter((day) => !day.isRestDay).length;
    const restDays = Math.max(template.daysPerWeek - workoutDays, 0);
    const previewTags = template.days.slice(0, 4).map((day, idxTag) => {
      if (day.isRestDay) {
        return `Rest`;
      }
      return `D${idxTag + 1}`;
    });

    return (
      <Animated.View entering={FadeInDown.delay(120 + index * 70)}>
        <TouchableOpacity
          onPress={() => handleTemplateSelect(template.id)}
          style={styles.templateCard}
          activeOpacity={0.78}
        >
          <View style={styles.templateCardTop}>
            <View style={styles.templateIcon}>
              <Icons.Barbell size={28} color={colors.white} weight="fill" />
            </View>

            <View style={styles.templateInfo}>
              <View style={styles.templateTitleRow}>
                <Typo size={20} fontWeight="700" color={colors.text}>
                  {template.name}
                </Typo>
                {index === 0 && (
                  <View style={styles.templateBadge}>
                    <Typo size={10} fontWeight="700" color={colors.primary}>
                      STARTER
                    </Typo>
                  </View>
                )}
              </View>

              <Typo
                size={12}
                color={colors.neutral300}
                style={styles.templateDescription}
              >
                {template.description}
              </Typo>
            </View>

            <View style={styles.templateArrow}>
              <Icons.ArrowUpRight size={18} color={colors.black} weight="bold" />
            </View>
          </View>

          <View style={styles.templateStats}>
            <View style={styles.statBadge}>
              <Icons.CalendarBlank size={13} color={colors.primary} weight="fill" />
              <Typo size={11} fontWeight="700" color={colors.primary}>
                {template.daysPerWeek}x/week
              </Typo>
            </View>
            <View style={styles.statBadge}>
              <Icons.ListChecks size={13} color={colors.primary} weight="fill" />
              <Typo size={11} fontWeight="700" color={colors.primary}>
                {exerciseCount} exercises
              </Typo>
            </View>
            <View style={styles.statBadge}>
              <Icons.Coffee size={13} color={colors.primary} weight="fill" />
              <Typo size={11} fontWeight="700" color={colors.primary}>
                {restDays} rest day
              </Typo>
            </View>
          </View>

          <View style={styles.previewRow}>
            {previewTags.map((tag, idxTag) => (
              <View key={`${template.id}-${tag}-${idxTag}`} style={styles.previewChip}>
                <Typo size={10} color={colors.neutral300} fontWeight="600">
                  {tag}
                </Typo>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const OptionCard = ({
    icon: Icon,
    title,
    description,
    onPress,
    loading,
    accentColor,
    tag,
    delay,
  }: {
    icon: React.ComponentType<any>;
    title: string;
    description: string;
    onPress: () => void;
    loading?: boolean;
    accentColor: string;
    tag: string;
    delay: number;
  }) => (
    <Animated.View entering={FadeInDown.delay(delay)}>
      <TouchableOpacity
        onPress={onPress}
        style={styles.optionCard}
        activeOpacity={0.8}
        disabled={loading}
      >
        <View style={[styles.optionAccent, { backgroundColor: accentColor }]} />
        <View
          style={[
            styles.optionIconContainer,
            { borderColor: accentColor },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Icon size={24} color={accentColor} weight="fill" />
          )}
        </View>

        <View style={styles.optionContent}>
          <View style={styles.optionTitleRow}>
            <Typo size={16} fontWeight="700" color={colors.text}>
              {title}
            </Typo>
            <View style={styles.optionTag}>
              <Typo size={10} fontWeight="700" color={colors.neutral300}>
                {tag}
              </Typo>
            </View>
          </View>
          <Typo
            size={12}
            color={colors.neutral300}
            style={styles.optionDescription}
          >
            {description}
          </Typo>
        </View>

        <View style={[styles.optionArrow, { backgroundColor: accentColor }]}>
          <Icons.CaretRight size={16} color={colors.black} weight="bold" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <ModalWrapper>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header
          title={view === "main" ? "Create Workout Plan" : "Select Template"}
          leftIcon={
            view === "templates" ? (
              <BackButton onPress={handleBackToMain} />
            ) : (
              <BackButton />
            )
          }
          style={styles.header}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {view === "main" ? (
            <>
              <Animated.View entering={FadeInDown.delay(80)} style={styles.heroCard}>
                <View style={styles.heroGlowPrimary} />
                <View style={styles.heroGlowSecondary} />

                <Typo size={11} fontWeight="700" color={colors.primary}>
                  SMART PLAN BUILDER
                </Typo>
                <Typo size={32} variant="heading" color={colors.white}>
                  Build faster. Train smarter.
                </Typo>
                <Typo size={13} color={colors.neutral300} style={styles.heroSubtitle}>
                  Pick a setup path below and get your workout split ready in under
                  two minutes.
                </Typo>

                <View style={styles.heroPillsRow}>
                  <View style={styles.heroPill}>
                    <Icons.Lightning size={14} color={colors.primary} weight="fill" />
                    <Typo size={11} color={colors.neutral300}>
                      Fast Setup
                    </Typo>
                  </View>
                  <View style={styles.heroPill}>
                    <Icons.FadersHorizontal
                      size={14}
                      color={colors.primary}
                      weight="fill"
                    />
                    <Typo size={11} color={colors.neutral300}>
                      Fully Editable
                    </Typo>
                  </View>
                </View>
              </Animated.View>

              <View style={styles.section}>
                <Typo
                  size={13}
                  fontWeight="700"
                  color={colors.neutral400}
                  style={styles.sectionTitle}
                >
                  CHOOSE YOUR WORKFLOW
                </Typo>

                <OptionCard
                  icon={Icons.SquaresFour}
                  title="Template"
                  description="Start from proven splits and tweak details later."
                  onPress={handleShowTemplates}
                  accentColor={colors.primary}
                  tag="RECOMMENDED"
                  delay={140}
                />

                <OptionCard
                  icon={Icons.PencilSimpleLine}
                  title="Create Custom"
                  description="Build your exact split structure from zero."
                  onPress={handleCustomPlan}
                  accentColor={colors.chartWarning}
                  tag="FLEXIBLE"
                  delay={190}
                />

                <OptionCard
                  icon={Icons.UploadSimple}
                  title="Import from Excel"
                  description="Bring your existing plan and continue editing."
                  onPress={handleImportExcel}
                  loading={importing}
                  accentColor={colors.waterAccent}
                  tag="MIGRATE"
                  delay={240}
                />
              </View>

              <Animated.View entering={FadeInDown.delay(280)} style={styles.infoCard}>
                <Typo size={14} fontWeight="700" color={colors.text}>
                  Quick Setup Flow
                </Typo>
                <View style={styles.infoRow}>
                  <View style={styles.infoBullet} />
                  <Typo size={12} color={colors.neutral300}>
                    Pick a path and configure your split days.
                  </Typo>
                </View>
                <View style={styles.infoRow}>
                  <View style={styles.infoBullet} />
                  <Typo size={12} color={colors.neutral300}>
                    Add exercises for each day in the editor.
                  </Typo>
                </View>
                <View style={styles.infoRow}>
                  <View style={styles.infoBullet} />
                  <Typo size={12} color={colors.neutral300}>
                    Save once, then edit anytime from the Workout tab.
                  </Typo>
                </View>
              </Animated.View>
            </>
          ) : (
            <>
              <Animated.View entering={FadeInDown.delay(100)} style={styles.templatesHero}>
                <Typo size={22} fontWeight="700" color={colors.white}>
                  Pick a proven split
                </Typo>
                <Typo size={13} color={colors.neutral300}>
                  All templates are editable before save. Start with one and adapt
                  it to your goals.
                </Typo>
                <View style={styles.templatesHeroStats}>
                  <View style={styles.templatesHeroStatChip}>
                    <Typo size={11} fontWeight="700" color={colors.primary}>
                      {WORKOUT_TEMPLATES.length} templates
                    </Typo>
                  </View>
                  <View style={styles.templatesHeroStatChip}>
                    <Typo size={11} fontWeight="700" color={colors.primary}>
                      {totalTemplateExercises} exercises
                    </Typo>
                  </View>
                </View>
              </Animated.View>

              <View style={styles.templatesContainer}>
                {WORKOUT_TEMPLATES.map((template, index) => (
                  <TemplateCard key={template.id} template={template} index={index} />
                ))}
              </View>

              <Animated.View entering={FadeInDown.delay(320)} style={styles.infoCard}>
                <Typo size={14} fontWeight="700" color={colors.text}>
                  Not sure where to start?
                </Typo>
                <Typo size={12} color={colors.neutral300} style={styles.infoDescription}>
                  Full Body is the easiest option to begin, then move to
                  Upper/Lower when you want more training volume.
                </Typo>
              </Animated.View>
            </>
          )}
        </ScrollView>
      </View>
    </ModalWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    marginBottom: spacingY._12,
  },
  scrollContent: {
    paddingHorizontal: spacingX._16,
    paddingBottom: spacingY._30,
    gap: spacingY._15,
  },
  section: {
    gap: spacingY._10,
  },
  sectionTitle: {
    letterSpacing: 1.2,
    marginBottom: spacingY._5,
  },
  heroCard: {
    backgroundColor: colors.neutral900,
    borderRadius: radius._20,
    borderWidth: 1.5,
    borderColor: colors.neutral700,
    padding: spacingX._20,
    overflow: "hidden",
    gap: spacingY._10,
  },
  heroGlowPrimary: {
    position: "absolute",
    width: verticalScale(180),
    height: verticalScale(180),
    borderRadius: 999,
    backgroundColor: "rgba(168,225,12,0.16)",
    top: -verticalScale(75),
    right: -verticalScale(45),
  },
  heroGlowSecondary: {
    position: "absolute",
    width: verticalScale(120),
    height: verticalScale(120),
    borderRadius: 999,
    backgroundColor: "rgba(59,130,246,0.18)",
    bottom: -verticalScale(55),
    left: -verticalScale(35),
  },
  heroSubtitle: {
    lineHeight: 18,
    maxWidth: "95%",
  },
  heroPillsRow: {
    flexDirection: "row",
    gap: spacingX._10,
    marginTop: spacingY._5,
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
    paddingHorizontal: spacingX._10,
    paddingVertical: spacingY._7,
    backgroundColor: "rgba(20,20,20,0.78)",
    borderRadius: radius._10,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  optionCard: {
    backgroundColor: colors.neutral900,
    borderRadius: radius._17,
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._15,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.neutral700,
    position: "relative",
    overflow: "hidden",
  },
  optionAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  optionIconContainer: {
    width: verticalScale(46),
    height: verticalScale(46),
    borderRadius: radius._10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacingX._12,
    borderWidth: 1.5,
    backgroundColor: "rgba(20,20,20,0.75)",
  },
  optionContent: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  optionTag: {
    paddingHorizontal: spacingX._7,
    paddingVertical: 2,
    borderRadius: radius._6,
    borderWidth: 1,
    borderColor: colors.neutral600,
    backgroundColor: "rgba(10,10,10,0.6)",
  },
  optionDescription: {
    marginTop: spacingY._5,
    lineHeight: 16,
  },
  optionArrow: {
    width: verticalScale(28),
    height: verticalScale(28),
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: spacingX._10,
  },
  templatesHero: {
    backgroundColor: colors.neutral900,
    borderRadius: radius._20,
    borderWidth: 1.5,
    borderColor: colors.neutral700,
    padding: spacingX._20,
    gap: spacingY._10,
  },
  templatesHeroStats: {
    flexDirection: "row",
    gap: spacingX._10,
    marginTop: spacingY._5,
  },
  templatesHeroStatChip: {
    borderWidth: 1,
    borderColor: colors.neutral700,
    backgroundColor: "rgba(10,10,10,0.65)",
    borderRadius: radius._10,
    paddingHorizontal: spacingX._10,
    paddingVertical: spacingY._7,
  },
  templatesContainer: {
    gap: spacingY._10,
  },
  templateCard: {
    backgroundColor: colors.neutral900,
    borderRadius: radius._17,
    padding: spacingX._15,
    borderWidth: 1.5,
    borderColor: colors.neutral700,
    gap: spacingY._10,
  },
  templateCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
  },
  templateIcon: {
    width: verticalScale(54),
    height: verticalScale(54),
    borderRadius: radius._12,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  templateInfo: {
    flex: 1,
  },
  templateTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
    flexWrap: "wrap",
  },
  templateBadge: {
    paddingHorizontal: spacingX._7,
    paddingVertical: 2,
    borderRadius: radius._6,
    backgroundColor: "rgba(168,225,12,0.16)",
    borderWidth: 1,
    borderColor: "rgba(168,225,12,0.35)",
  },
  templateDescription: {
    marginTop: spacingY._5,
    lineHeight: 16,
  },
  templateArrow: {
    width: verticalScale(30),
    height: verticalScale(30),
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  templateStats: {
    flexDirection: "row",
    gap: spacingX._7,
    flexWrap: "wrap",
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._5,
    backgroundColor: "rgba(10,10,10,0.75)",
    paddingHorizontal: spacingX._8,
    paddingVertical: spacingY._5,
    borderRadius: radius._10,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  previewRow: {
    flexDirection: "row",
    gap: spacingX._7,
    flexWrap: "wrap",
  },
  previewChip: {
    paddingHorizontal: spacingX._8,
    paddingVertical: 3,
    borderRadius: radius._10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  infoCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    borderWidth: 1.5,
    borderColor: colors.neutral700,
    padding: spacingX._15,
    gap: spacingY._7,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  infoBullet: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  infoDescription: {
    marginTop: 6,
  },
});

export default WorkoutPlanSelectionScreen;
