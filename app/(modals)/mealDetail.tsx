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
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
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
    (mealName as string) || "Mic Dejun",
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

  // State for showing success toast message
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // State for recent food quantity modal
  const [selectedRecentFood, setSelectedRecentFood] = useState<Food | null>(
    null,
  );
  const [recentFoodQuantity, setRecentFoodQuantity] = useState("100");

  // Swipe to dismiss modal gesture handling
  const modalTranslateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only activate on vertical movement
        return (
          Math.abs(gestureState.dy) > 10 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
        );
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward swipe
        if (gestureState.dy > 0) {
          modalTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped down more than 150px, dismiss the modal
        if (gestureState.dy > 150) {
          Animated.timing(modalTranslateY, {
            toValue: 500,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            setShowQuantityModal(false);
            setSelectedFood(null);
            setSelectedRecentFood(null);
            modalTranslateY.setValue(0);
          });
        } else {
          // Otherwise, spring back to original position
          Animated.spring(modalTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
          }).start();
        }
      },
    }),
  ).current;

  const mealDropdownRef = useRef<TouchableOpacity>(null);

  const currentMeal =
    MEALS.find((meal) => meal.name === selectedMeal) ||
    MEALS.find((meal) => meal.name === mealName) ||
    MEALS[0];

  // Load recent foods when meal changes
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
        ` Loaded ${result.data.length} recent foods for ${currentMeal.name}`,
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
    modalTranslateY.setValue(0);
    setSelectedFood(food);
    setQuantity("100");
    setShowQuantityModal(true);
  }, []);

  // Show success toast animation
  const showSuccessToastMessage = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessToast(true);

    // Fade in
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSuccessToast(false);
    });
  };

  // Quick add from recent foods with same quantity (no confirmation)
  const handleQuickAddRecentFood = useCallback(
    async (food: Food) => {
      try {
        await addFoodToMeal(currentMeal.name, food);
        showSuccessToastMessage(`${food.name} added successfully`);
      } catch (error: any) {
        Alert.alert("Error", error?.message || "Failed to add the food");
      }
    },
    [currentMeal.name, addFoodToMeal],
  );

  // Show quantity modal for recent food when clicking on food body
  const handleRecentFoodBodyPress = useCallback((food: Food) => {
    modalTranslateY.setValue(0);
    setSelectedRecentFood(food);
    // Extract quantity from servingSize if available, otherwise default to 100
    const servingMatch = food.servingSize?.match(/(\d+)/);
    const defaultQuantity = servingMatch ? servingMatch[1] : "100";
    setRecentFoodQuantity(defaultQuantity);
    setShowQuantityModal(true);
  }, []);

  // Add recent food with custom quantity
  const handleAddRecentFoodWithQuantity = async () => {
    if (
      !selectedRecentFood ||
      !recentFoodQuantity ||
      parseFloat(recentFoodQuantity) <= 0
    ) {
      Alert.alert("Error", "Please enter a valid quantity.");
      return;
    }

    setAddingFood(true);

    // Extract original quantity from servingSize
    const originalServingMatch = selectedRecentFood.servingSize?.match(/(\d+)/);
    const originalQuantity = originalServingMatch
      ? parseFloat(originalServingMatch[1])
      : 100;

    const qty = parseFloat(recentFoodQuantity);
    const multiplier = qty / originalQuantity;

    const adjustedFood: Food = {
      name: selectedRecentFood.name,
      calories: Math.round(selectedRecentFood.calories * multiplier),
      protein: Math.round(selectedRecentFood.protein * multiplier * 10) / 10,
      carbs: Math.round(selectedRecentFood.carbs * multiplier * 10) / 10,
      fat: Math.round(selectedRecentFood.fat * multiplier * 10) / 10,
      servingSize: `${qty}g`,
    };

    try {
      await addFoodToMeal(currentMeal.name, adjustedFood);

      setAddingFood(false);
      setShowQuantityModal(false);
      setSelectedRecentFood(null);

      showSuccessToastMessage(`${adjustedFood.name} added successfully`);
    } catch (error: any) {
      setAddingFood(false);
      Alert.alert("Error", error?.message || "Failed to add the food");
    }
  };

  const handleAddWithQuantity = async () => {
    if (!selectedFood || !quantity || parseFloat(quantity) <= 0) {
      Alert.alert("Error", "Please enter a valid quantity.");
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

      showSuccessToastMessage(`${adjustedFood.name} added successfully`);
    } catch (error: any) {
      setAddingFood(false);
      Alert.alert("Error", error?.message || "Failed to add the food");
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

  // Render item for search results - FlashList
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
          <Typo size={16} fontWeight="600" numberOfLines={2}>
            {food.name}
          </Typo>
          <View style={styles.nutritionRow}>
            <Typo size={13} color={colors.neutral400}>
              {food.calories} kcal
            </Typo>
            <Typo size={13} color={colors.neutral400}>
              •
            </Typo>
            <Typo size={13} color={colors.neutral400}>
              P: {food.protein}g
            </Typo>
            <Typo size={13} color={colors.neutral400}>
              •
            </Typo>
            <Typo size={13} color={colors.neutral400}>
              C: {food.carbs}g
            </Typo>
            <Typo size={13} color={colors.neutral400}>
              •
            </Typo>
            <Typo size={13} color={colors.neutral400}>
              F: {food.fat}g
            </Typo>
          </View>
        </View>
      </TouchableOpacity>
    ),
    [handleFoodPress],
  );

  const renderRecentFoodItem = useCallback(
    ({ item: food }: { item: Food }) => (
      <View style={styles.recentFoodItem}>
        {/* Main touchable area - clicking here opens quantity modal */}
        <TouchableOpacity
          style={styles.recentFoodBodyArea}
          onPress={() => handleRecentFoodBodyPress(food)}
        >
          <View style={styles.foodInfo}>
            <Typo size={16} fontWeight="600" numberOfLines={2}>
              {food.name}
            </Typo>
            <View style={styles.nutritionRow}>
              <Typo size={13} color={colors.neutral400}>
                {food.calories} kcal
              </Typo>
              <Typo size={13} color={colors.neutral400}>
                •
              </Typo>
              <Typo size={13} color={colors.neutral400}>
                P: {food.protein}g
              </Typo>
              <Typo size={13} color={colors.neutral400}>
                •
              </Typo>
              <Typo size={13} color={colors.neutral400}>
                C: {food.carbs}g
              </Typo>
              <Typo size={13} color={colors.neutral400}>
                •
              </Typo>
              <Typo size={13} color={colors.neutral400}>
                F: {food.fat}g
              </Typo>
            </View>
            <Typo size={12} color={colors.neutral500}>
              {food.servingSize}
            </Typo>
          </View>
        </TouchableOpacity>

        {/* Quick add button with plus icon */}
        <TouchableOpacity
          style={styles.quickAddButton}
          onPress={() => handleQuickAddRecentFood(food)}
        >
          <Icons.Plus size={24} color={colors.primary} weight="bold" />
        </TouchableOpacity>
      </View>
    ),
    [handleRecentFoodBodyPress, handleQuickAddRecentFood],
  );

  const RecentFoodsEmptyState = useCallback(
    () => (
      <View style={styles.emptyState}>
        <Icons.ForkKnife size={48} color={colors.neutral600} weight="light" />
        <Typo
          size={16}
          color={colors.neutral500}
          style={{ marginTop: spacingY._15, textAlign: "center" }}
        >
          You have no recent foods for {currentMeal.name}
        </Typo>
      </View>
    ),
    [currentMeal.name],
  );

  return (
    <ModalWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton iconSize={26} />

          <TouchableOpacity
            ref={mealDropdownRef}
            style={styles.mealDropdown}
            onPress={measureDropdown}
          >
            <Typo size={24} fontWeight="700" style={styles.mealTitle}>
              {currentMeal.name}
            </Typo>
            <Icons.CaretDown
              size={verticalScale(20)}
              color={colors.primary}
              weight="bold"
            />
          </TouchableOpacity>

          <View style={{ width: verticalScale(28) }} />
        </View>

        {/* Meal Dropdown Modal */}
        <Modal
          visible={showMealDropdown}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMealDropdown(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.dropdownOverlay}
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
                    meal.name === currentMeal.name && styles.dropdownItemActive,
                  ]}
                  onPress={() => handleMealSelect(meal.id)}
                >
                  <Typo
                    size={16}
                    fontWeight={meal.name === currentMeal.name ? "600" : "500"}
                  >
                    {meal.name}
                  </Typo>
                  {meal.name === currentMeal.name && (
                    <Icons.Check
                      size={20}
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
            <View style={styles.searchIcon}>
              <Icons.MagnifyingGlass
                size={20}
                color={colors.neutral400}
                weight="bold"
              />
            </View>
            <Input
              placeholder="Search for food..."
              value={searchQuery}
              onChangeText={handleSearch}
              containerStyle={styles.searchInput}
              inputStyle={styles.searchInputText}
            />
            {isSearching && (
              <View style={styles.searchLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </View>
        </View>

        {/* Search Results */}
        {searchQuery.trim().length >= 2 && (
          <View style={styles.searchResultsContainer}>
            <FlashList
              data={searchResults}
              renderItem={renderSearchResultItem}
              keyExtractor={(item, index) => `search-${index}`}
              estimatedItemSize={80}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.flashListContent}
              ListEmptyComponent={
                !isSearching ? (
                  <View style={styles.emptyState}>
                    <Typo size={16} color={colors.neutral500}>
                      No results found
                    </Typo>
                  </View>
                ) : null
              }
            />
          </View>
        )}

        {/* Action Buttons & Recent Foods */}
        {searchQuery.trim().length < 2 && (
          <>
            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleManualCalories}
              >
                <View style={styles.actionButtonContent}>
                  <Icons.PencilSimple
                    size={28}
                    color={colors.primary}
                    weight="bold"
                  />
                  <View style={styles.actionTextContainer}>
                    <Typo size={13} style={styles.actionButtonText}>
                      Manual
                    </Typo>
                    <Typo size={13} style={styles.actionButtonText}>
                      Calories
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
                    size={28}
                    color={colors.primary}
                    weight="bold"
                  />
                  <View style={styles.actionTextContainer}>
                    <Typo size={13} style={styles.actionButtonText}>
                      Barcode
                    </Typo>
                    <Typo size={13} style={styles.actionButtonText}>
                      Scanner
                    </Typo>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Recent Foods Section */}
            <View style={styles.recentFoodsSection}>
              <Typo size={18} fontWeight="700" style={styles.sectionTitle}>
                Recent Foods
              </Typo>

              {loadingRecent ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
                <View style={styles.recentFoodsListContainer}>
                  <FlashList
                    data={recentFoods}
                    renderItem={renderRecentFoodItem}
                    keyExtractor={(item, index) => `recent-${index}`}
                    estimatedItemSize={80}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={RecentFoodsEmptyState}
                  />
                </View>
              )}
            </View>
          </>
        )}

        {/* Quantity Modal - for both search results and recent foods */}
        <Modal
          visible={showQuantityModal}
          animationType="slide"
          transparent
          onRequestClose={() => {
            setShowQuantityModal(false);
            setSelectedFood(null);
            setSelectedRecentFood(null);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <View style={styles.modalOverlay}>
              <TouchableOpacity
                activeOpacity={1}
                style={styles.modalBackdrop}
                onPress={() => {
                  setShowQuantityModal(false);
                  setSelectedFood(null);
                  setSelectedRecentFood(null);
                }}
              />

              <Animated.View
                style={[
                  styles.quantityModal,
                  {
                    transform: [{ translateY: modalTranslateY }],
                    paddingBottom: insets.bottom + spacingY._20,
                  },
                ]}
              >
                <View
                  {...panResponder.panHandlers}
                  style={styles.modalHeaderContainer}
                >
                  {/* Handle Bar */}
                  <View style={styles.handleBar} />

                  {/* Modal Header */}
                  <View style={styles.modalHeader}>
                    <Typo size={20} fontWeight="700">
                      Adjust Quantity
                    </Typo>
                    <TouchableOpacity
                      onPress={() => {
                        setShowQuantityModal(false);
                        setSelectedFood(null);
                        setSelectedRecentFood(null);
                      }}
                    >
                      <Icons.X
                        size={24}
                        color={colors.neutral400}
                        weight="bold"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  {/* Modal Content - for search results */}
                  {selectedFood && (
                    <View style={styles.modalContent}>
                      {/* Food Info */}
                      <View style={styles.foodInfoModal}>
                        {selectedFood.image && (
                          <Image
                            source={{ uri: selectedFood.image }}
                            style={styles.foodImageLarge}
                            contentFit="cover"
                          />
                        )}
                        <Typo
                          size={20}
                          fontWeight="700"
                          style={{
                            marginTop: spacingY._15,
                            textAlign: "center",
                          }}
                        >
                          {selectedFood.name}
                        </Typo>
                      </View>

                      {/* Quantity Input */}
                      <View style={{ marginBottom: spacingY._25 }}>
                        <Typo
                          size={16}
                          fontWeight="600"
                          style={{ marginBottom: spacingY._10 }}
                        >
                          Quantity (grams)
                        </Typo>
                        <Input
                          value={quantity}
                          onChangeText={setQuantity}
                          keyboardType="numeric"
                          placeholder="100"
                        />
                      </View>

                      {/* Nutrition Preview */}
                      <View style={{ marginBottom: spacingY._20 }}>
                        <Typo
                          size={16}
                          fontWeight="600"
                          style={{ marginBottom: spacingY._15 }}
                        >
                          Nutritional Values
                        </Typo>
                        <View style={styles.nutritionPreview}>
                          <View style={styles.nutritionItem}>
                            <Typo
                              size={24}
                              fontWeight="700"
                              color={colors.primary}
                            >
                              {Math.round(
                                (selectedFood.calories *
                                  (parseFloat(quantity) || 0)) /
                                  100,
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
                                  10,
                              ) / 10}
                              g
                            </Typo>
                            <Typo size={12} color={colors.neutral400}>
                              Protein
                            </Typo>
                          </View>

                          <View style={styles.nutritionItem}>
                            <Typo size={20} fontWeight="600">
                              {Math.round(
                                ((selectedFood.carbs *
                                  (parseFloat(quantity) || 0)) /
                                  100) *
                                  10,
                              ) / 10}
                              g
                            </Typo>
                            <Typo size={12} color={colors.neutral400}>
                              Carbohydrates
                            </Typo>
                          </View>

                          <View style={styles.nutritionItem}>
                            <Typo size={20} fontWeight="600">
                              {Math.round(
                                ((selectedFood.fat *
                                  (parseFloat(quantity) || 0)) /
                                  100) *
                                  10,
                              ) / 10}
                              g
                            </Typo>
                            <Typo size={12} color={colors.neutral400}>
                              Fats
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
                          Add to {currentMeal.name}
                        </Typo>
                      </Button>
                    </View>
                  )}

                  {/* Modal Content - for recent foods */}
                  {selectedRecentFood && (
                    <View style={styles.modalContent}>
                      {/* Food Info */}
                      <View style={styles.foodInfoModal}>
                        <Typo
                          size={20}
                          fontWeight="700"
                          style={{
                            marginTop: spacingY._15,
                            textAlign: "center",
                          }}
                        >
                          {selectedRecentFood.name}
                        </Typo>
                        <Typo
                          size={14}
                          color={colors.neutral400}
                          style={{ marginTop: spacingY._5 }}
                        >
                          Current: {selectedRecentFood.servingSize}
                        </Typo>
                      </View>

                      {/* Quantity Input */}
                      <View style={{ marginBottom: spacingY._25 }}>
                        <Typo
                          size={16}
                          fontWeight="600"
                          style={{ marginBottom: spacingY._10 }}
                        >
                          Quantity (grams)
                        </Typo>
                        <Input
                          value={recentFoodQuantity}
                          onChangeText={setRecentFoodQuantity}
                          keyboardType="numeric"
                          placeholder="100"
                        />
                      </View>

                      {/* Nutrition Preview */}
                      <View style={{ marginBottom: spacingY._20 }}>
                        <Typo
                          size={16}
                          fontWeight="600"
                          style={{ marginBottom: spacingY._15 }}
                        >
                          Nutritional Values
                        </Typo>
                        <View style={styles.nutritionPreview}>
                          {(() => {
                            const originalServingMatch =
                              selectedRecentFood.servingSize?.match(/(\d+)/);
                            const originalQuantity = originalServingMatch
                              ? parseFloat(originalServingMatch[1])
                              : 100;
                            const multiplier =
                              (parseFloat(recentFoodQuantity) || 0) /
                              originalQuantity;

                            return (
                              <>
                                <View style={styles.nutritionItem}>
                                  <Typo
                                    size={24}
                                    fontWeight="700"
                                    color={colors.primary}
                                  >
                                    {Math.round(
                                      selectedRecentFood.calories * multiplier,
                                    )}
                                  </Typo>
                                  <Typo size={12} color={colors.neutral400}>
                                    kcal
                                  </Typo>
                                </View>

                                <View style={styles.nutritionItem}>
                                  <Typo size={20} fontWeight="600">
                                    {Math.round(
                                      selectedRecentFood.protein *
                                        multiplier *
                                        10,
                                    ) / 10}
                                    g
                                  </Typo>
                                  <Typo size={12} color={colors.neutral400}>
                                    Protein
                                  </Typo>
                                </View>

                                <View style={styles.nutritionItem}>
                                  <Typo size={20} fontWeight="600">
                                    {Math.round(
                                      selectedRecentFood.carbs *
                                        multiplier *
                                        10,
                                    ) / 10}
                                    g
                                  </Typo>
                                  <Typo size={12} color={colors.neutral400}>
                                    Carbohydrates
                                  </Typo>
                                </View>

                                <View style={styles.nutritionItem}>
                                  <Typo size={20} fontWeight="600">
                                    {Math.round(
                                      selectedRecentFood.fat * multiplier * 10,
                                    ) / 10}
                                    g
                                  </Typo>
                                  <Typo size={12} color={colors.neutral400}>
                                    Fats
                                  </Typo>
                                </View>
                              </>
                            );
                          })()}
                        </View>
                      </View>

                      <Button
                        onPress={handleAddRecentFoodWithQuantity}
                        loading={addingFood}
                        style={{ marginTop: spacingY._20 }}
                      >
                        <Typo size={18} fontWeight="700" color={colors.black}>
                          Add to {currentMeal.name}
                        </Typo>
                      </Button>
                    </View>
                  )}
                </ScrollView>
              </Animated.View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Success Toast */}
        {showSuccessToast && (
          <Animated.View
            style={[
              styles.successToast,
              {
                opacity: toastOpacity,
                bottom: insets.bottom + spacingY._20,
              },
            ]}
          >
            <Icons.CheckCircle size={20} color={colors.green} weight="fill" />
            <Typo size={14} fontWeight="600" color={colors.white}>
              {successMessage}
            </Typo>
          </Animated.View>
        )}
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
    marginBottom: spacingY._10,
    overflow: "hidden",
  },
  recentFoodBodyArea: {
    flex: 1,
    padding: spacingX._12,
  },
  quickAddButton: {
    padding: spacingX._15,
    justifyContent: "center",
    alignItems: "center",
    borderLeftWidth: 1,
    borderLeftColor: colors.neutral700,
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
    maxHeight: "70%",
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.neutral600,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacingY._15,
  },
  modalHeaderContainer: {
    paddingTop: spacingY._15,
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
    width: verticalScale(120),
    height: verticalScale(120),
    borderRadius: radius._15,
    backgroundColor: colors.neutral700,
  },
  nutritionPreview: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    padding: spacingX._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  nutritionItem: {
    alignItems: "center",
    gap: verticalScale(4),
  },
  successToast: {
    position: "absolute",
    left: spacingX._20,
    right: spacingX._20,
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    padding: spacingX._15,
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    borderWidth: 1,
    borderColor: colors.green,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
