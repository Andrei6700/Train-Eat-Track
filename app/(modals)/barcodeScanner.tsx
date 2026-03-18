import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useLanguage } from "@/src/contexts/languageContext";
import { useNutrition } from "@/src/contexts/nutritionContext";
import { getMealLabel } from "@/src/i18n/translations";
import {
  getFoodByBarcode,
  SimplifiedFood,
} from "@/src/services/foodApiService";
import { verticalScale } from "@/src/utils/styling";
import { Camera, CameraView } from "expo-camera";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BarcodeScanner = () => {
  const router = useRouter();
  const { mealName } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { addFoodToMeal } = useNutrition();
  const { language, t } = useLanguage();
  const mealLabel = getMealLabel(language, mealName as string);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scannedFood, setScannedFood] = useState<SimplifiedFood | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);

  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [quantity, setQuantity] = useState("100");
  const [addingFood, setAddingFood] = useState(false);

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === "granted");
  };

  const handleBarCodeScanned = async ({
    type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    if (scanned) return;

    setScanned(true);
    setLoading(true);

    console.log(`Scanned barcode: ${data}`);

    const result = await getFoodByBarcode(data);

    setLoading(false);

    if (result.success && result.data) {
      setScannedFood(result.data);
      setQuantity("100");
      setShowQuantityModal(true);
    } else {
      Alert.alert(
        t("barcode_scanner_modal_not_found_title"),
        t("barcode_scanner_modal_not_found_message"),
        [
          { text: t("common_cancel"), onPress: () => router.back() },
          { text: t("barcode_scanner_modal_try_again"), onPress: () => setScanned(false) },
        ],
      );
    }
  };

  const handleAddWithQuantity = async () => {
    if (!scannedFood || !quantity || parseFloat(quantity) <= 0) {
      Alert.alert(t("common_error"), t("nutrition_invalid_quantity"));
      return;
    }

    setAddingFood(true);

    const qty = parseFloat(quantity);
    const multiplier = qty / 100;

    const adjustedFood = {
      name: scannedFood.name,
      calories: Math.round(scannedFood.calories * multiplier),
      protein: Math.round(scannedFood.protein * multiplier * 10) / 10,
      carbs: Math.round(scannedFood.carbs * multiplier * 10) / 10,
      fat: Math.round(scannedFood.fat * multiplier * 10) / 10,
      servingSize: `${qty}g`,
    };

    try {
      // saved in firebase by context
      await addFoodToMeal(mealName as string, adjustedFood);

      setAddingFood(false);
      setShowQuantityModal(false);
      setScannedFood(null);

      Alert.alert(
        t("common_success"),
        t("barcode_scanner_modal_success_added_to_meal", {
          name: adjustedFood.name,
          meal: mealLabel,
        }),
        [
          {
            text: t("common_ok"),
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error: any) {
      setAddingFood(false);
      Alert.alert(t("common_error"), error?.message || t("barcode_scanner_modal_error_add"));
    }
  };

  const handleScanAgain = () => {
    setScanned(false);
    setScannedFood(null);
    setShowQuantityModal(false);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Typo
            size={16}
            color={colors.neutral400}
            style={{ marginTop: spacingY._15 }}
          >
            {t("barcode_scanner_modal_checking_permissions")}
          </Typo>
        </View>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Animated.View
          entering={FadeIn.duration(400)}
          style={styles.permissionContainer}
        >
          <Icons.CameraSlashIcon size={64} color={colors.rose} weight="fill" />
          <Typo
            size={20}
            fontWeight="700"
            style={{ marginTop: spacingY._20, textAlign: "center" }}
          >
            {t("barcode_scanner_modal_camera_access_denied_title")}
          </Typo>
          <Typo
            size={15}
            color={colors.neutral400}
            style={{ marginTop: spacingY._10, textAlign: "center" }}
          >
            {t("barcode_scanner_modal_camera_access_denied_message")}
          </Typo>
          <Button
            onPress={() => Linking.openSettings()}
            style={{ marginTop: spacingY._30, width: "80%" }}
          >
            <Typo size={16} fontWeight="700" color={colors.black}>
              {t("barcode_scanner_modal_open_settings")}
            </Typo>
          </Button>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginTop: spacingY._15 }}
          >
            <Typo size={15} color={colors.primary}>
              {t("barcode_scanner_modal_back")}
            </Typo>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: [
            "ean13",
            "ean8",
            "upc_a",
            "upc_e",
            "code128",
            "code39",
            "qr",
          ],
        }}
      />

      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(400)}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Icons.XIcon size={24} color={colors.white} weight="bold" />
        </TouchableOpacity>

        <Typo size={18} fontWeight="700" color={colors.white}>
          {t("barcode_scanner_modal_title")}
        </Typo>

        <TouchableOpacity
          onPress={() => setFlashEnabled(!flashEnabled)}
          style={styles.headerButton}
        >
          {flashEnabled ? (
            <Icons.FlashlightIcon
              size={24}
              color={colors.primary}
              weight="fill"
            />
          ) : (
            <Icons.FlashlightIcon
              size={24}
              color={colors.white}
              weight="regular"
            />
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Scanner Frame */}
      {!scanned && (
        <Animated.View
          entering={FadeIn.delay(300).duration(600)}
          style={styles.scannerFrame}
          pointerEvents="none"
        >
          <View style={styles.scannerBox}>
            {/* Corners */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          <Typo
            size={16}
            fontWeight="600"
            color={colors.white}
            style={styles.scannerText}
          >
            {t("barcode_scanner_modal_position_hint")}
          </Typo>
        </Animated.View>
      )}

      {/* Loading Overlay */}
      {loading && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(300)}
          style={styles.loadingOverlay}
          pointerEvents="none"
        >
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Typo
              size={16}
              fontWeight="600"
              style={{ marginTop: spacingY._15 }}
            >
              {t("barcode_scanner_modal_searching_food")}
            </Typo>
          </View>
        </Animated.View>
      )}

      {/* Quantity Modal */}
      <Modal
        visible={showQuantityModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQuantityModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowQuantityModal(false)}
          />

          <View
            style={[
              styles.quantityModal,
              { paddingBottom: insets.bottom + 20 },
            ]}
          >
            {/* Handle Bar */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleScanAgain}>
                <Icons.ArrowCounterClockwiseIcon
                  size={24}
                  color={colors.primary}
                  weight="bold"
                />
              </TouchableOpacity>
              <Typo size={20} fontWeight="700">
                {t("barcode_scanner_modal_add_food_title")}
              </Typo>
              <TouchableOpacity onPress={() => setShowQuantityModal(false)}>
                <Icons.XIcon size={24} color={colors.white} weight="bold" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.quantityScrollContent}
            >
              {/* Food Info */}
              {scannedFood && (
                <View style={styles.modalContent}>
                  <View style={styles.foodInfoModal}>
                    {scannedFood.image ? (
                      <Image
                        source={{ uri: scannedFood.image }}
                        style={styles.foodImageLarge}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.foodImagePlaceholder} />
                    )}
                    <Typo
                      size={18}
                      fontWeight="700"
                      style={styles.modalFoodTitle}
                      textProps={{ numberOfLines: 2 }}
                    >
                      {scannedFood.name}
                    </Typo>
                    {scannedFood.brands && (
                      <Typo
                        size={14}
                        color={colors.neutral400}
                        style={styles.modalFoodSubtitle}
                        textProps={{ numberOfLines: 1 }}
                      >
                        {scannedFood.brands}
                      </Typo>
                    )}
                  </View>

                  {/* Quantity Input */}
                  <View style={styles.quantitySection}>
                    <Typo
                      size={16}
                      fontWeight="600"
                      style={{ marginBottom: spacingY._12 }}
                    >
                      {t("nutrition_quantity_grams")}
                    </Typo>
                    <Input
                      placeholder="100"
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="numeric"
                      containerStyle={styles.quantityInput}
                    />
                    <Typo
                      size={13}
                      color={colors.neutral400}
                      style={{ marginTop: spacingY._7 }}
                    >
                      {t("barcode_scanner_modal_values_per_100g")}
                    </Typo>
                  </View>

                  {/* Adjusted Nutritional Values */}
                  <View style={styles.adjustedNutrition}>
                    <Typo
                      size={15}
                      fontWeight="600"
                      style={{ marginBottom: spacingY._12 }}
                    >
                      {t("nutrition_calculated_values_for", { value: quantity || "0" })}
                    </Typo>

                    <View style={styles.nutritionGrid}>
                      <View style={styles.nutritionItem}>
                        <Typo size={24} fontWeight="700" color={colors.primary}>
                          {Math.round(
                            (scannedFood.calories *
                              (parseFloat(quantity) || 0)) /
                              100
                          )}
                        </Typo>
                        <Typo size={12} color={colors.neutral400}>
                          kcal
                        </Typo>
                      </View>

                      <View style={styles.nutritionItem}>
                        <Typo size={20} fontWeight="600">
                          {Math.round(
                            ((scannedFood.protein *
                              (parseFloat(quantity) || 0)) /
                              100) *
                              10
                          ) / 10}
                          g
                        </Typo>
                        <Typo size={12} color={colors.neutral400}>
                          {t("nutrition_protein")}
                        </Typo>
                      </View>

                      <View style={styles.nutritionItem}>
                        <Typo size={20} fontWeight="600">
                          {Math.round(
                            ((scannedFood.carbs * (parseFloat(quantity) || 0)) /
                              100) *
                              10
                          ) / 10}
                          g
                        </Typo>
                        <Typo size={12} color={colors.neutral400}>
                          {t("nutrition_carbs")}
                        </Typo>
                      </View>

                      <View style={styles.nutritionItem}>
                        <Typo size={20} fontWeight="600">
                          {Math.round(
                            ((scannedFood.fat * (parseFloat(quantity) || 0)) /
                              100) *
                              10
                          ) / 10}
                          g
                        </Typo>
                        <Typo size={12} color={colors.neutral400}>
                          {t("nutrition_fat")}
                        </Typo>
                      </View>
                    </View>
                  </View>

                  {/* Add Button */}
                  <Button
                    onPress={handleAddWithQuantity}
                    loading={addingFood}
                    style={{ marginTop: spacingY._20 }}
                  >
                    <Typo size={18} fontWeight="700" color={colors.black}>
                      {t("barcode_scanner_modal_add_to_meal", { meal: mealLabel || t("barcode_scanner_modal_meal_fallback") })}
                    </Typo>
                  </Button>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default BarcodeScanner;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacingX._30,
    backgroundColor: colors.neutral900,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacingX._20,
    paddingVertical: spacingY._15,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  scannerFrame: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  scannerBox: {
    width: 280,
    height: 200,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: radius._10,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: radius._10,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: radius._10,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: radius._10,
  },
  scannerText: {
    marginTop: spacingY._30,
    textAlign: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: spacingX._20,
    paddingVertical: spacingY._10,
    borderRadius: radius._12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._30,
    alignItems: "center",
    minWidth: 200,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  quantityModal: {
    backgroundColor: colors.neutral900,
    borderTopLeftRadius: radius._20,
    borderTopRightRadius: radius._20,
    maxHeight: "85%",
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
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacingX._20,
    marginBottom: spacingY._20,
  },
  modalContent: {
    paddingHorizontal: spacingX._20,
  },
  quantityScrollContent: {
    paddingBottom: spacingY._25,
  },
  foodInfoModal: {
    alignItems: "center",
    marginBottom: spacingY._25,
  },
  modalFoodTitle: {
    marginTop: spacingY._12,
    textAlign: "center",
    maxWidth: "96%",
  },
  modalFoodSubtitle: {
    textAlign: "center",
    maxWidth: "96%",
  },
  foodImageLarge: {
    width: verticalScale(100),
    height: verticalScale(100),
    borderRadius: radius._15,
    backgroundColor: colors.neutral700,
  },
  foodImagePlaceholder: {
    width: verticalScale(100),
    height: verticalScale(100),
    borderRadius: radius._15,
    backgroundColor: colors.neutral800,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  quantitySection: {
    marginBottom: spacingY._25,
  },
  quantityInput: {
    backgroundColor: colors.neutral800,
  },
  adjustedNutrition: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._17,
    padding: spacingX._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacingX._15,
    justifyContent: "space-between",
  },
  nutritionItem: {
    alignItems: "center",
    width: "45%",
    backgroundColor: colors.neutral900,
    padding: spacingX._15,
    borderRadius: radius._12,
  },
});

