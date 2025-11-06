import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import ModalWrapper from "@/src/components/layout/ModalWrapper";
import BackButton from "@/src/components/navigation/BackButton";
import Input from "@/src/components/ui/Input";
import Typo from "@/src/components/ui/Typo";
import { verticalScale } from "@/src/utils/styling";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Meal types
const MEALS = [
  { id: "breakfast", name: "Mic Dejun" },
  { id: "lunch", name: "Pranz" },
  { id: "dinner", name: "Cina" },
  { id: "snacks", name: "Gustari" },
];

const MealDetail = () => {
  const { mealName } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMeal, setSelectedMeal] = useState(mealName as string || "breakfast");
  const [showMealDropdown, setShowMealDropdown] = useState(false);
  const [recentFoods, setRecentFoods] = useState<any[]>([]);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0, width: 0 });
  
  const mealDropdownRef = useRef<TouchableOpacity>(null);

  const measureDropdown = () => {
    if (mealDropdownRef.current) {
      mealDropdownRef.current.measure((x, y, width, height, pageX, pageY) => {
        setDropdownPosition({
          x: pageX,
          y: pageY + height,
          width: width
        });
        setShowMealDropdown(true);
      });
    }
  };

  const currentMeal = MEALS.find(meal => meal.id === selectedMeal) || MEALS[0];

  const handleMealSelect = (mealId: string) => {
    setSelectedMeal(mealId);
    setShowMealDropdown(false);
  };

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
            <Icons.CaretDownIcon size={16} color={colors.neutral400} weight="bold" />
          </TouchableOpacity>
          <View style={{ width: 24 }} />
        </View>

        {/* Meal Dropdown Modal - Positioned under the button */}
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
            <View style={[
              styles.dropdownContainer,
              {
                position: 'absolute',
                top: dropdownPosition.y,
                left: dropdownPosition.x,
                width: dropdownPosition.width,
              }
            ]}>
              {MEALS.map((meal) => (
                <TouchableOpacity
                  key={meal.id}
                  style={[
                    styles.dropdownItem,
                    selectedMeal === meal.id && styles.dropdownItemActive
                  ]}
                  onPress={() => handleMealSelect(meal.id)}
                >
                  <Typo 
                    size={16} 
                    fontWeight="600"
                    color={selectedMeal === meal.id ? colors.primary : colors.text}
                  >
                    {meal.name}
                  </Typo>
                  {selectedMeal === meal.id && (
                    <Icons.CheckIcon size={16} color={colors.primary} weight="bold" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Search Bar - Fixed spacing */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Icons.MagnifyingGlassIcon 
              size={20} 
              color={colors.neutral400} 
              style={styles.searchIcon}
            />
            <Input
              placeholder="Caută alimente (ex. Piept de pui)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              containerStyle={styles.searchInput}
              inputStyle={styles.searchInputText}
            />
          </View>
        </View>

        {/* Action Buttons - HORIZONTAL with icons EXACT 1:1 with image.png */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionButtonContent}>
              <Icons.Calculator size={24} color={colors.primary} weight="fill" />
              <View style={styles.actionTextContainer}>
                <Typo size={13} fontWeight="700" style={styles.actionButtonText}>
                  Introdu
                </Typo>
                <Typo size={13} fontWeight="700" style={styles.actionButtonText}>
                  calorii manual
                </Typo>
              </View>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionButtonContent}>
              <Icons.PlusCircle size={24} color={colors.primary} weight="fill" />
              <View style={styles.actionTextContainer}>
                <Typo size={13} fontWeight="700" style={styles.actionButtonText}>
                  Creează
                </Typo>
                <Typo size={13} fontWeight="700" style={styles.actionButtonText}>
                  aliment/rețetă
                </Typo>
              </View>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionButtonContent}>
              <Icons.Barcode size={24} color={colors.primary} weight="fill" />
              <View style={styles.actionTextContainer}>
                <Typo size={13} fontWeight="700" style={styles.actionButtonText}>
                  Caută după
                </Typo>
                <Typo size={13} fontWeight="700" style={styles.actionButtonText}>
                  cod de bare
                </Typo>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Recent Foods Section */}
        <View style={styles.recentFoodsSection}>
          <Typo size={18} fontWeight="700" style={styles.sectionTitle}>
            Alimente recente
          </Typo>

          <ScrollView 
            style={styles.foodsList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.foodsListContent,
              recentFoods.length === 0 && styles.emptyFoodsListContent
            ]}
          >
            {recentFoods.length > 0 ? (
              recentFoods.map((food) => (
                <TouchableOpacity
                  key={food.id}
                  style={styles.foodItem}
                  onPress={() => {}}
                >
                  <View style={styles.foodItemLeft}>
                    <View style={[
                      styles.checkbox,
                      food.checked && styles.checkboxChecked
                    ]}>
                      {food.checked && (
                        <Icons.CheckIcon size={12} color={colors.black} weight="bold" />
                      )}
                    </View>
                    
                    <View style={styles.foodInfo}>
                      <Typo size={15} fontWeight="600" style={styles.foodName}>
                        {food.name}
                      </Typo>
                      {(food.calories > 0 || food.amount) && (
                        <Typo size={13} color={colors.neutral400}>
                          {food.calories > 0 && `${food.calories} kCal`}
                          {food.calories > 0 && food.amount && ', '}
                          {food.amount}
                        </Typo>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Icons.ForkKnifeIcon size={48} color={colors.neutral500} weight="fill" />
                <Typo 
                  size={16} 
                  fontWeight="600" 
                  color={colors.neutral400} 
                  style={{ marginTop: spacingY._15, textAlign: 'center' }}
                >
                  Nu ai alimente recente
                </Typo>
                <Typo 
                  size={14} 
                  color={colors.neutral500} 
                  style={{ marginTop: spacingY._7, textAlign: 'center' }}
                >
                  Alimentele pe care le adaugi vor apărea aici
                </Typo>
              </View>
            )}
          </ScrollView>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingY._20,
    paddingTop: spacingY._10,
  },
  mealDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: spacingY._8,
  },
  mealTitle: {
    marginRight: spacingX._5,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dropdownContainer: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    paddingVertical: spacingY._5,
    borderWidth: 1,
    borderColor: colors.neutral700,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: spacingX._15,
    top: '50%',
    marginTop: -10,
    zIndex: 2,
  },
  searchInput: {
    marginBottom: 0,
  },
  searchInputText: {
    paddingLeft: spacingX._35,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextContainer: {
    alignItems: 'center',
    marginTop: spacingY._5,
  },
  actionButtonText: {
    textAlign: 'center',
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
  foodsList: {
    flex: 1,
  },
  foodsListContent: {
    paddingBottom: verticalScale(20),
  },
  emptyFoodsListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral800,
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._12,
    padding: spacingX._15,
    marginBottom: spacingY._10,
  },
  foodItemLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: colors.neutral500,
    borderRadius: radius._3,
    marginRight: spacingX._12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    marginBottom: spacingY._4,
    color: colors.text,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacingY._50,
    paddingHorizontal: spacingX._20,
  },
});