import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { auth } from "@/src/config/firebase";
import { useLanguage } from "@/src/contexts/languageContext";
import { useNutrition } from "@/src/contexts/nutritionContext";
import { getMealLabel } from "@/src/i18n/translations";
import { saveCustomProduct } from "@/src/services/customProductService";
import { Food } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Icons from "phosphor-react-native";
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const IMAGE_SIZE_LIMIT_BYTES = 2 * 1024 * 1024;

const toSingleParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] || "" : value || "";

const normalizeBarcode = (value: string): string =>
  value.trim().replace(/[^\d]/g, "");

const parseNonNegative = (value: string): number | null => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const inferImageMimeType = (uri: string): string => {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
};

const toDataUrl = async (uri: string): Promise<string> => {
  if (uri.startsWith("data:image/")) return uri;

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: "base64",
  });
  const mimeType = inferImageMimeType(uri);
  return `data:${mimeType};base64,${base64}`;
};

const ManualProductEntry = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mealName, barcode } = useLocalSearchParams();
  const { addFoodToMeal } = useNutrition();
  const { language, t } = useLanguage();

  const initialBarcode = useMemo(() => toSingleParam(barcode), [barcode]);
  const mealNameValue = useMemo(() => toSingleParam(mealName), [mealName]);
  const mealLabel = getMealLabel(language, mealNameValue);

  const [productBarcode, setProductBarcode] = useState(initialBarcode);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [servingSize, setServingSize] = useState("100g");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  const closeFlow = () => {
    try {
      if (mealNameValue) {
        router.dismiss(2);
        return;
      }
    } catch {
      // Fallback to normal back navigation
    }
    router.back();
  };

  const handleSave = async () => {
    const normalizedBarcode = normalizeBarcode(productBarcode);
    const caloriesValue = parseNonNegative(calories);
    const proteinValue = parseNonNegative(protein);
    const carbsValue = parseNonNegative(carbs);
    const fatValue = parseNonNegative(fat);
    const fiberValue = fiber.trim() ? parseNonNegative(fiber) : 0;

    if (!normalizedBarcode) {
      Alert.alert(t("common_error"), "Barcode is required.");
      return;
    }

    if (!name.trim()) {
      Alert.alert(t("common_error"), "Product name is required.");
      return;
    }

    if (caloriesValue === null || caloriesValue <= 0) {
      Alert.alert(t("common_error"), "Calories must be a positive number.");
      return;
    }

    if (proteinValue === null || carbsValue === null || fatValue === null) {
      Alert.alert(
        t("common_error"),
        "Protein, carbs, and fat must be non-negative numbers.",
      );
      return;
    }

    if (fiberValue === null) {
      Alert.alert(t("common_error"), "Fiber must be a non-negative number.");
      return;
    }

    if (!servingSize.trim()) {
      Alert.alert(t("common_error"), "Serving size is required.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser?.uid) {
      Alert.alert(t("common_error"), "You must be logged in to save products.");
      return;
    }

    setSaving(true);

    try {
      let imageDataUrl: string | undefined;
      if (imageUri) {
        try {
          const fileInfo = (await FileSystem.getInfoAsync(imageUri)) as {
            exists: boolean;
            size?: number;
          };
          if (fileInfo.exists && typeof fileInfo.size === "number") {
            if (fileInfo.size > IMAGE_SIZE_LIMIT_BYTES) {
              Alert.alert(
                "Large image",
                "Image is larger than 2MB and may impact performance.",
              );
            }
          }
          imageDataUrl = await toDataUrl(imageUri);
        } catch (imageError) {
          if (__DEV__) {
            console.error("[ManualProductEntry] Image conversion failed:", imageError);
          }
          Alert.alert(
            "Image skipped",
            "Image upload failed. Product will be saved without image.",
          );
        }
      }

      const saved = await saveCustomProduct(currentUser.uid, {
        barcode: normalizedBarcode,
        name: name.trim(),
        brand: brand.trim() || undefined,
        calories: Math.round(caloriesValue),
        protein: Math.round(proteinValue * 10) / 10,
        carbs: Math.round(carbsValue * 10) / 10,
        fat: Math.round(fatValue * 10) / 10,
        fiber: Math.round(fiberValue * 10) / 10,
        servingSize: servingSize.trim(),
        image: imageDataUrl,
        source: "manual",
      });

      if (!saved) {
        Alert.alert(t("common_error"), "Failed to save product. Please try again.");
        return;
      }

      if (mealNameValue) {
        const food: Food = {
          name: saved.name,
          calories: saved.calories,
          protein: saved.protein,
          carbs: saved.carbs,
          fat: saved.fat,
          servingSize: saved.servingSize,
        };
        await addFoodToMeal(mealNameValue, food);
      }

      Alert.alert(
        t("common_success"),
        mealNameValue
          ? `${saved.name} was saved and added to ${mealLabel || t("barcode_scanner_modal_meal_fallback")}.`
          : `${saved.name} was saved successfully.`,
        [{ text: t("common_ok"), onPress: closeFlow }],
      );
    } catch (error: any) {
      Alert.alert(t("common_error"), error?.message || "Could not save product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardView}
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={SlideInDown.duration(360).springify()}
          exiting={SlideOutDown.duration(260)}
          style={[styles.container, { paddingBottom: insets.bottom + 20 }]}
        >
          <View style={styles.handleBar} />

          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Icons.XIcon size={24} color={colors.white} weight="bold" />
            </TouchableOpacity>
            <Typo size={20} fontWeight="700">
              Manual Product Entry
            </Typo>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <Animated.View entering={FadeInDown.delay(140).duration(360)}>
              <Typo size={13} color={colors.neutral400} style={styles.infoText}>
                Fill nutrition values per 100g or 100ml for best quantity scaling.
              </Typo>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(190).duration(360)} style={styles.inputGroup}>
              <Typo size={14} fontWeight="600" style={styles.label}>
                Barcode *
              </Typo>
              <Input
                placeholder="e.g. 5449000000996"
                value={productBarcode}
                onChangeText={setProductBarcode}
                keyboardType="number-pad"
                containerStyle={styles.input}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(230).duration(360)} style={styles.inputGroup}>
              <Typo size={14} fontWeight="600" style={styles.label}>
                Product Name *
              </Typo>
              <Input
                placeholder="e.g. Protein Bar"
                value={name}
                onChangeText={setName}
                containerStyle={styles.input}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(270).duration(360)} style={styles.inputGroup}>
              <Typo size={14} fontWeight="600" style={styles.label}>
                Brand
              </Typo>
              <Input
                placeholder="e.g. Quest"
                value={brand}
                onChangeText={setBrand}
                containerStyle={styles.input}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(310).duration(360)} style={styles.inputGroup}>
              <Typo size={14} fontWeight="600" style={styles.label}>
                Product Image (Optional)
              </Typo>
              {imageUri ? (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
                  <TouchableOpacity
                    onPress={() => setImageUri(null)}
                    style={styles.removeImageButton}
                  >
                    <Icons.XIcon size={20} color={colors.white} weight="bold" />
                  </TouchableOpacity>
                </View>
              ) : null}
              <View style={styles.imageActions}>
                <TouchableOpacity style={styles.imageActionButton} onPress={handleTakePhoto}>
                  <Icons.CameraIcon size={18} color={colors.primary} weight="fill" />
                  <Typo size={13} fontWeight="600">
                    Camera
                  </Typo>
                </TouchableOpacity>
                <TouchableOpacity style={styles.imageActionButton} onPress={handlePickImage}>
                  <Icons.ImageIcon size={18} color={colors.primary} weight="fill" />
                  <Typo size={13} fontWeight="600">
                    Gallery
                  </Typo>
                </TouchableOpacity>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(350).duration(360)}>
              <Typo size={16} fontWeight="700" style={styles.sectionTitle}>
                Nutrition (per 100g/ml)
              </Typo>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(390).duration(360)} style={styles.row}>
              <View style={styles.rowItem}>
                <Typo size={12} color={colors.neutral400} style={styles.fieldLabel}>
                  Calories *
                </Typo>
                <Input
                  placeholder="0"
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="numeric"
                  containerStyle={styles.input}
                />
              </View>
              <View style={styles.rowItem}>
                <Typo size={12} color={colors.neutral400} style={styles.fieldLabel}>
                  Protein (g) *
                </Typo>
                <Input
                  placeholder="0"
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="decimal-pad"
                  containerStyle={styles.input}
                />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(430).duration(360)} style={styles.row}>
              <View style={styles.rowItem}>
                <Typo size={12} color={colors.neutral400} style={styles.fieldLabel}>
                  Carbs (g) *
                </Typo>
                <Input
                  placeholder="0"
                  value={carbs}
                  onChangeText={setCarbs}
                  keyboardType="decimal-pad"
                  containerStyle={styles.input}
                />
              </View>
              <View style={styles.rowItem}>
                <Typo size={12} color={colors.neutral400} style={styles.fieldLabel}>
                  Fat (g) *
                </Typo>
                <Input
                  placeholder="0"
                  value={fat}
                  onChangeText={setFat}
                  keyboardType="decimal-pad"
                  containerStyle={styles.input}
                />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(470).duration(360)} style={styles.row}>
              <View style={styles.rowItem}>
                <Typo size={12} color={colors.neutral400} style={styles.fieldLabel}>
                  Fiber (g)
                </Typo>
                <Input
                  placeholder="0"
                  value={fiber}
                  onChangeText={setFiber}
                  keyboardType="decimal-pad"
                  containerStyle={styles.input}
                />
              </View>
              <View style={styles.rowItem}>
                <Typo size={12} color={colors.neutral400} style={styles.fieldLabel}>
                  Serving Size *
                </Typo>
                <Input
                  placeholder="100g"
                  value={servingSize}
                  onChangeText={setServingSize}
                  containerStyle={styles.input}
                />
              </View>
            </Animated.View>
          </ScrollView>

          <View style={styles.footer}>
            <Button onPress={handleSave} loading={saving}>
              <Typo size={17} fontWeight="700" color={colors.black}>
                Save Product
              </Typo>
            </Button>
          </View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ManualProductEntry;

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: colors.neutral900,
    borderTopLeftRadius: radius._20,
    borderTopRightRadius: radius._20,
    maxHeight: "95%",
    paddingTop: spacingY._15,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.neutral600,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacingY._15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacingX._20,
    marginBottom: spacingY._15,
  },
  scrollContent: {
    paddingHorizontal: spacingX._20,
    paddingBottom: spacingY._20,
  },
  infoText: {
    marginBottom: spacingY._15,
  },
  inputGroup: {
    marginBottom: spacingY._15,
  },
  label: {
    marginBottom: spacingY._7,
  },
  input: {
    backgroundColor: colors.neutral800,
  },
  sectionTitle: {
    marginTop: spacingY._7,
    marginBottom: spacingY._12,
  },
  row: {
    flexDirection: "row",
    gap: spacingX._10,
    marginBottom: spacingY._12,
  },
  rowItem: {
    flex: 1,
  },
  fieldLabel: {
    marginBottom: spacingY._5,
  },
  imageActions: {
    flexDirection: "row",
    gap: spacingX._10,
    marginTop: spacingY._10,
  },
  imageActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._7,
    backgroundColor: colors.neutral800,
    borderColor: colors.neutral700,
    borderWidth: 1,
    borderRadius: radius._10,
    paddingHorizontal: spacingX._12,
    paddingVertical: spacingY._10,
    flex: 1,
  },
  imagePreview: {
    width: "100%",
    height: verticalScale(130),
    borderRadius: radius._15,
    overflow: "hidden",
    backgroundColor: colors.neutral800,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  removeImageButton: {
    position: "absolute",
    top: spacingY._7,
    right: spacingX._7,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: spacingX._20,
    paddingTop: spacingY._15,
    borderTopWidth: 1,
    borderTopColor: colors.neutral700,
  },
  headerSpacer: {
    width: 24,
  },
});
