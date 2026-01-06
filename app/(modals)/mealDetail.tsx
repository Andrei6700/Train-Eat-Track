import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Button from "@/src/components/ui/Button";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { useAuth } from "@/src/contexts/authContext";
import { useNutrition } from "@/src/contexts/nutritionContext";
import { searchFood, SimplifiedFood } from "@/src/services/foodApiService";
import { getRecentFoodsByMeal } from "@/src/services/recentFoodsService";
import { Food } from "@/src/types/index";
import { verticalScale } from "@/src/utils/styling";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MEALS = [
  { id: "breakfast", name: "Mic Dejun" },
  { id: "lunch", name: "Pranz" },
  { id: "dinner", name: "Cina" },
  { id: "snacks", name: "Gustari" },
];

const MealDetail = () => {
  const { mealName } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addFoodToMeal } = useNutrition();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMeal, setSelectedMeal] = useState(
    (mealName as string) || "Mic Dejun"
  );
  const [showMealDropdown, setShowMealDropdown] = useState(false);
  const [recentFoods, setRecentFoods] = useState<Food[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [dropdownPosition, setDropdownPosition] = useState({
    x: 0,
    y: 0,
    width: 0,
  });

  const [searchResults, setSearchResults] = useState<SimplifiedFood[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedFood, setSelectedFood] = useState<SimplifiedFood | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [addingFood, setAddingFood] = useState(false);

  const mealDropdownRef = useRef<TouchableOpacity>(null);

  const currentMeal =
    MEALS.find((meal) => meal.name === selectedMeal) ||
    MEALS.find((meal) => meal.name === mealName) ||
    MEALS[0];

  // ✅ ÎNCARCĂ ALIMENTELE RECENTE PENTRU MASA CURENTĂ
  useEffect(() => {
    loadRecentFoods();
  }, [currentMeal.name, user?.uid]);

  const loadRecentFoods = async () => {
    if (!user?.uid) {
      setLoadingRecent(false);
      return;
    }

    setLoadingRecent(true);
    const result = await getRecentFoodsByMeal(user.uid, currentMeal.name, 10);

    if (result.success && result.data) {
      setRecentFoods(result.data);
      console.log(
        `✅ Loaded ${result.data.length} recent foods for ${currentMeal.name}`
      );
    } else {
      setRecentFoods([]);
    }
    setLoadingRecent(false);
  };

  const measureDropdown = () => {
    if (mealDropdownRef.current) {
      mealDropdownRef.current.measure((x, y, width, height, pageX, pageY) => {
        setDropdownPosition({
          x: pageX,
          y: pageY + height,
          width: width,
        });
        setShowMealDropdown(true);
      });
    }
  };

  const handleMealSelect = (mealId: string) => {
    const selected = MEALS.find((m) => m.id === mealId);
    if (selected) {
      setSelectedMeal(selected.name);
    }
    setShowMealDropdown(false);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchFood(text.trim(), 1, 20);
      setSearchResults(results);
      setIsSearching(false);
    }, 500);
  };

  const handleFoodPress = useCallback((food: SimplifiedFood) => {
    setSelectedFood(food);
    setQuantity("100");
    setShowQuantityModal(true);
  }, []);

  // ✅ ADAUGĂ ALIMENT DIN LISTA RECENTĂ
  const handleRecentFoodPress = useCallback(
    (food: Food) => {
      Alert.alert(
        "Adaugă aliment",
        `Vrei să adaugi "${food.name}" la ${currentMeal.name}?`,
        [
          { text: "Anulează", style: "cancel" },
          {
            text: "Adaugă",
            onPress: async () => {
              try {
                await addFoodToMeal(currentMeal.name, food);
                Alert.alert(
                  "Success",
                  `${food.name} a fost adăugat la ${currentMeal.name}! 🎉`,
                  [
                    {
                      text: "OK",
                      onPress: () => router.back(),
                    },
                  ]
                );
              } catch (error: any) {
                Alert.alert(
                  "Eroare",
                  error?.message || "Nu s-a putut adăuga alimentul"
                );
              }
            },
          },
        ]
      );
    },
    [currentMeal.name, addFoodToMeal, router]
  );

  const handleAddWithQuantity = async () => {
    if (!selectedFood || !quantity || parseFloat(quantity) <= 0) {
      Alert.alert("Eroare", "Te rog introdu o cantitate validă");
      return;
    }

    setAddingFood(true);

    const qty = parseFloat(quantity);
    const multiplier = qty / 100;

    const adjustedFood = {
      name: selectedFood.name,
      calories: Math.round(selectedFood.calories * multiplier),
      protein: Math.round(selectedFood.protein * multiplier * 10) / 10,
      carbs: Math.round(selectedFood.carbs * multiplier * 10) / 10,
      fat: Math.round(selectedFood.fat * multiplier * 10) / 10,
      servingSize: `${qty}g`,
    };

    try {
      await addFoodToMeal(currentMeal.name, adjustedFood);

      setAddingFood(false);
      setShowQuantityModal(false);
      setSelectedFood(null);
      setSearchQuery("");
      setSearchResults([]);

      Alert.alert(
        "Success",
        `${adjustedFood.name} a fost adăugat la ${currentMeal.name}! 🎉`,
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      setAddingFood(false);
      Alert.alert("Eroare", error?.message || "Nu s-a putut adăuga alimentul");
    }
  };

  const handleManualCalories = () => {
    router.push({
      pathname: "/(modals)/manualCalories",
      params: { mealName: currentMeal.name },
    });
  };

  const handleBarcodeScanner = () => {
    router.push({
      pathname: "/(modals)/barcodeScanner",
      params: { mealName: currentMeal.name },
    });
  };

  // ✅ RENDER ITEM PENTRU SEARCH RESULTS - FLASHLIST
  const renderSearchResultItem = useCallback(
    ({ item: food }: { item: SimplifiedFood }) => (
      <TouchableOpacity
        style={styles.searchResultItem}
        onPress={() => handleFoodPress(food)}
      >
        {food.image && (
          <Image
            source={{ uri: food.image }}
            style={styles.foodImage}
            contentFit="cover"
          />
        )}
        <View style={styles.foodInfo}>
          <Typo size={15} fontWeight="600" numberOfLines={2}>
            {food.name}
          </Typo>
          {food.brands && (
            <Typo size={12} color={colors.neutral400} numberOfLines={1}>
              {food.brands}
            </Typo>
          )}
          <View style={styles.nutritionRow}>
            <Typo size={13} color={colors.primary}>
              {food.calories} kcal
            </Typo>
            <Typo size={12} color={colors.neutral400}>
              P: {food.protein}g • C: {food.carbs}g • F: {food.fat}g
            </Typo>
          </View>
          <Typo size={11} color={colors.neutral500}>
            {food.servingSize}
          </Typo>
        </View>
        <Icons.PlusCircle size={24} color={colors.primary} weight="fill" />
      </TouchableOpacity>
    ),
    [handleFoodPress]
  );

  // ✅ RENDER ITEM PENTRU RECENT FOODS - FLASHLIST
  const renderRecentFoodItem = useCallback(
    ({ item: food }: { item: Food }) => (
      <TouchableOpacity
        style={styles.recentFoodItem}
        onPress={() => handleRecentFoodPress(food)}
      >
        <View style={styles.foodInfo}>
          <Typo size={15} fontWeight="600" numberOfLines={1}>
            {food.name}
          </Typo>
          <View style={styles.nutritionRow}>
            <Typo size={13} color={colors.primary}>
              {food.calories} kcal
            </Typo>
            <Typo size={12} color={colors.neutral400}>
              P: {food.protein}g • C: {food.carbs}g • F: {food.fat}g
            </Typo>
          </View>
          <Typo size={11} color={colors.neutral500}>
            {food.servingSize}
          </Typo>
        </View>
        <Icons.PlusCircle size={24} color={colors.primary} weight="fill" />
      </TouchableOpacity>
    ),
    [handleRecentFoodPress]
  );

  // ✅ EMPTY STATE COMPONENT PENTRU RECENT FOODS
  const RecentFoodsEmptyState = useCallback(
    () => (
      <View style={styles.emptyState}>
        <Icons.ForkKnife size={48} color={colors.neutral500} weight="fill" />
        <Typo
          size={16}
          fontWeight="600"
          color={colors.neutral400}
          style={{ marginTop: spacingY._15, textAlign: "center" }}
        >
          Nu ai alimente recente pentru {currentMeal.name}
        </Typo>
        <Typo
          size={14}
          color={colors.neutral500}
          style={{ marginTop: spacingY._7, textAlign: "center" }}
        >
          Alimentele pe care le adaugi la această masă vor apărea aici
        </Typo>
      </View>
    ),
    [currentMeal.name]
  );

  // ✅ HEADER COMPONENT PENTRU SEARCH RESULTS
  const SearchResultsHeader = useCallback(
    () => (
      <Typo size={16} fontWeight="600" style={{ marginBottom: spacingY._10 }}>
        Rezultate căutare ({searchResults.length})
      </Typo>
    ),
    [searchResults.length]
  );

  return (
    <ModalWrapper>
      <View style={styles.container}>
        {/* Custom Header with Dropdown */}
        <View style={styles.header}>
          <BackButton />
          <TouchableOpacity
            ref={mealDropdownRef}
            style={styles.mealDropdown}
            onPress={measureDropdown}
          >
            <Typo size={18} fontWeight="700" style={styles.mealTitle}>
              {currentMeal.name}
            </Typo>
            <Icons.CaretDown
              size={16}
              color={colors.neutral400}
              weight="bold"
            />
          </TouchableOpacity>
          <View style={{ width: 24 }} />
        </View>

        {/* Meal Dropdown Modal */}
        <Modal
          visible={showMealDropdown}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMealDropdown(false)}
        >
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={() => setShowMealDropdown(false)}
          >
            <View
              style={[
                styles.dropdownContainer,
                {
                  position: "absolute",
                  top: dropdownPosition.y,
                  left: dropdownPosition.x,
                  width: dropdownPosition.width,
                },
              ]}
            >
              {MEALS.map((meal) => (
                <TouchableOpacity
                  key={meal.id}
                  style={[
                    styles.dropdownItem,
                    selectedMeal === meal.name && styles.dropdownItemActive,
                  ]}
                  onPress={() => handleMealSelect(meal.id)}
                >
                  <Typo
                    size={16}
                    fontWeight="600"
                    color={
                      selectedMeal === meal.name ? colors.primary : colors.text
                    }
                  >
                    {meal.name}
                  </Typo>
                  {selectedMeal === meal.name && (
                    <Icons.Check
                      size={16}
                      color={colors.primary}
                      weight="bold"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Icons.MagnifyingGlass
              size={20}
              color={colors.neutral400}
              style={styles.searchIcon}
            />
            <Input
              placeholder="Caută alimente (ex. Piept de pui)"
              value={searchQuery}
              onChangeText={handleSearch}
              containerStyle={styles.searchInput}
              inputStyle={styles.searchInputText}
            />
            {isSearching && (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={styles.searchLoader}
              />
            )}
          </View>
        </View>

        {/* ✅ SEARCH RESULTS CU FLASHLIST */}
        {searchResults.length > 0 && (
          <View style={styles.searchResultsContainer}>
            <FlashList
              data={searchResults}
              renderItem={renderSearchResultItem}
              keyExtractor={(item, index) => `search-${item.code}-${index}`}
              estimatedItemSize={100}
              ListHeaderComponent={SearchResultsHeader}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.flashListContent}
            />
          </View>
        )}

        {/* Action Buttons & Recent Foods */}
        {searchResults.length === 0 && (
          <>
            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleManualCalories}
              >
                <View style={styles.actionButtonContent}>
                  <Icons.Calculator
                    size={24}
                    color={colors.primary}
                    weight="fill"
                  />
                  <View style={styles.actionTextContainer}>
                    <Typo
                      size={13}
                      fontWeight="700"
                      style={styles.actionButtonText}
                    >
                      Introdu
                    </Typo>
                    <Typo
                      size={13}
                      fontWeight="700"
                      style={styles.actionButtonText}
                    >
                      calorii manual
                    </Typo>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  router.push({
                    pathname: "/(modals)/createFood",
                    params: { mealName },
                  })
                }
              >
                <View style={styles.actionButtonContent}>
                  <Icons.PlusCircle
                    size={24}
                    color={colors.primary}
                    weight="fill"
                  />
                  <View style={styles.actionTextContainer}>
                    <Typo
                      size={13}
                      fontWeight="700"
                      style={styles.actionButtonText}
                    >
                      Creează
                    </Typo>
                    <Typo
                      size={13}
                      fontWeight="700"
                      style={styles.actionButtonText}
                    >
                      aliment/rețetă
                    </Typo>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleBarcodeScanner}
              >
                <View style={styles.actionButtonContent}>
                  <Icons.Barcode
                    size={24}
                    color={colors.primary}
                    weight="fill"
                  />
                  <View style={styles.actionTextContainer}>
                    <Typo
                      size={13}
                      fontWeight="700"
                      style={styles.actionButtonText}
                    >
                      Caută după
                    </Typo>
                    <Typo
                      size={13}
                      fontWeight="700"
                      style={styles.actionButtonText}
                    >
                      cod de bare
                    </Typo>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* ✅ RECENT FOODS SECTION CU FLASHLIST */}
            <View style={styles.recentFoodsSection}>
              <Typo size={18} fontWeight="700" style={styles.sectionTitle}>
                Alimente recente
              </Typo>

              {loadingRecent ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : (
                <View style={styles.recentFoodsListContainer}>
                  <FlashList
                    data={recentFoods}
                    renderItem={renderRecentFoodItem}
                    keyExtractor={(item, index) => `recent-${item.name}-${index}`}
                    estimatedItemSize={80}
                    ListEmptyComponent={RecentFoodsEmptyState}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.flashListContent}
                  />
                </View>
              )}
            </View>
          </>
        )}

        {/* ✅ MODAL PENTRU CANTITATE */}
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
              <View style={styles.handleBar} />

              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowQuantityModal(false)}>
                  <Icons.X size={24} color={colors.white} weight="bold" />
                </TouchableOpacity>
                <Typo size={20} fontWeight="700">
                  Adaugă aliment
                </Typo>
                <View style={{ width: 24 }} />
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {selectedFood && (
                  <View style={styles.modalContent}>
                    <View style={styles.foodInfoModal}>
                      {selectedFood.image && (
                        <Image
                          source={{ uri: selectedFood.image }}
                          style={styles.foodImageLarge}
                          contentFit="cover"
                        />
                      )}
                      <Typo
                        size={18}
                        fontWeight="700"
                        style={{ marginTop: spacingY._12 }}
                      >
                        {selectedFood.name}
                      </Typo>
                      {selectedFood.brands && (
                        <Typo size={14} color={colors.neutral400}>
                          {selectedFood.brands}
                        </Typo>
                      )}
                    </View>

                    <View style={styles.quantitySection}>
                      <Typo
                        size={16}
                        fontWeight="600"
                        style={{ marginBottom: spacingY._12 }}
                      >
                        Cantitate (grame)
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
                        style={{ marginTop: spacingY._8 }}
                      >
                        Valorile nutriționale sunt calculate pentru 100g
                      </Typo>
                    </View>

                    <View style={styles.adjustedNutrition}>
                      <Typo
                        size={15}
                        fontWeight="600"
                        style={{ marginBottom: spacingY._12 }}
                      >
                        Valori calculate pentru {quantity || "0"}g:
                      </Typo>

                      <View style={styles.nutritionGrid}>
                        <View style={styles.nutritionItem}>
                          <Typo
                            size={24}
                            fontWeight="700"
                            color={colors.primary}
                          >
                            {Math.round(
                              (selectedFood.calories *
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
                              ((selectedFood.protein *
                                (parseFloat(quantity) || 0)) /
                                100) *
                                10
                            ) / 10}
                            g
                          </Typo>
                          <Typo size={12} color={colors.neutral400}>
                            Proteine
                          </Typo>
                        </View>

                        <View style={styles.nutritionItem}>
                          <Typo size={20} fontWeight="600">
                            {Math.round(
                              ((selectedFood.carbs *
                                (parseFloat(quantity) || 0)) /
                                100) *
                                10
                            ) / 10}
                            g
                          </Typo>
                          <Typo size={12} color={colors.neutral400}>
                            Carbohidrați
                          </Typo>
                        </View>

                        <View style={styles.nutritionItem}>
                          <Typo size={20} fontWeight="600">
                            {Math.round(
                              ((selectedFood.fat *
                                (parseFloat(quantity) || 0)) /
                                100) *
                                10
                            ) / 10}
                            g
                          </Typo>
                          <Typo size={12} color={colors.neutral400}>
                            Grăsimi
                          </Typo>
                        </View>
                      </View>
                    </View>

                    <Button
                      onPress={handleAddWithQuantity}
                      loading={addingFood}
                      style={{ marginTop: spacingY._20 }}
                    >
                      <Typo size={18} fontWeight="700" color={colors.black}>
                        Adaugă la {currentMeal.name}
                      </Typo>
                    </Button>
                  </View>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </ModalWrapper>
  );
};

export default MealDetail;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacingY._20,
    paddingTop: spacingY._10,
  },
  mealDropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: spacingY._8,
  },
  mealTitle: {
    marginRight: spacingX._5,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  dropdownContainer: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    paddingVertical: spacingY._5,
    borderWidth: 1,
    borderColor: colors.neutral700,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._15,
  },
  dropdownItemActive: {
    backgroundColor: colors.neutral700,
  },
  searchContainer: {
    marginBottom: spacingY._20,
  },
  searchInputContainer: {
    position: "relative",
  },
  searchIcon: {
    position: "absolute",
    left: spacingX._15,
    top: "50%",
    marginTop: -10,
    zIndex: 2,
  },
  searchInput: {
    marginBottom: 0,
  },
  searchInputText: {
    paddingLeft: spacingX._35,
  },
  searchLoader: {
    position: "absolute",
    right: spacingX._15,
    top: "50%",
    marginTop: -10,
  },
  // ✅ STILURI PENTRU FLASHLIST SEARCH RESULTS
  searchResultsContainer: {
    flex: 1,
    marginBottom: spacingY._20,
  },
  flashListContent: {
    paddingBottom: spacingY._20,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral800,
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._12,
    padding: spacingX._12,
    marginBottom: spacingY._10,
    gap: spacingX._12,
  },
  foodImage: {
    width: verticalScale(60),
    height: verticalScale(60),
    borderRadius: radius._10,
    backgroundColor: colors.neutral700,
  },
  foodInfo: {
    flex: 1,
    gap: verticalScale(4),
  },
  nutritionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacingY._20,
    gap: spacingX._10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.neutral800,
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._12,
    paddingVertical: spacingY._12,
  },
  actionButtonContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextContainer: {
    alignItems: "center",
    marginTop: spacingY._5,
  },
  actionButtonText: {
    textAlign: "center",
    color: colors.text,
    lineHeight: 16,
  },
  // ✅ STILURI PENTRU FLASHLIST RECENT FOODS
  recentFoodsSection: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: spacingY._15,
    color: colors.text,
  },
  recentFoodsListContainer: {
    flex: 1,
    minHeight: verticalScale(200),
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacingY._50,
    paddingHorizontal: spacingX._20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacingY._50,
  },
  recentFoodItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral800,
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._12,
    padding: spacingX._12,
    marginBottom: spacingY._10,
    gap: spacingX._12,
  },
  // ✅ STILURI PENTRU MODAL
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
  foodInfoModal: {
    alignItems: "center",
    marginBottom: spacingY._25,
  },
  foodImageLarge: {
    width: verticalScale(100),
    height: verticalScale(100),
    borderRadius: radius._15,
    backgroundColor: colors.neutral700,
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