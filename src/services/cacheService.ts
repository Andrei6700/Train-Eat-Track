import { WorkoutHistory, WorkoutPlan, DailyNutrition, Food } from "@/src/types/index";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ==================== KEYS ====================
const CACHE_KEYS = {
  LAST_WORKOUT: "cached_last_workout",
  WORKOUT_PLAN: "cached_workout_plan",
  NUTRITION_PREFIX: "cached_nutrition_",
  CACHE_TIMESTAMP: "cache_timestamps",
  FOOD_CACHE: "cached_foods",
};

const CACHE_EXPIRY = {
  WORKOUT_PLAN: 24 * 60 * 60 * 1000, // 24 hours
  NUTRITION: 12 * 60 * 60 * 1000, // 12 hours
  LAST_WORKOUT: 7 * 24 * 60 * 60 * 1000, // 7 days
  FOOD_CACHE: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// ==================== TIMESTAMPS ====================
type CacheTimestamps = {
  [key: string]: number;
};

const getCacheTimestamps = async (): Promise<CacheTimestamps> => {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMP);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

const setCacheTimestamp = async (key: string): Promise<void> => {
  try {
    const timestamps = await getCacheTimestamps();
    timestamps[key] = Date.now();
    await AsyncStorage.setItem(
      CACHE_KEYS.CACHE_TIMESTAMP,
      JSON.stringify(timestamps)
    );
  } catch (error) {
    console.error("[CacheService] Error setting timestamp:", error);
  }
};

const isCacheValid = async (key: string, expiryMs: number): Promise<boolean> => {
  try {
    const timestamps = await getCacheTimestamps();
    const timestamp = timestamps[key];
    if (!timestamp) return false;
    return Date.now() - timestamp < expiryMs;
  } catch {
    return false;
  }
};

// ==================== LAST WORKOUT ====================
export const cacheLastWorkout = async (
  workout: WorkoutHistory
): Promise<void> => {
  try {
    if (!workout) {
      console.log(" [CacheService] Cannot cache null/undefined workout");
      return;
    }
    await AsyncStorage.setItem(
      CACHE_KEYS.LAST_WORKOUT,
      JSON.stringify(workout)
    );
    await setCacheTimestamp(CACHE_KEYS.LAST_WORKOUT);
    console.log(" [CacheService] Last workout cached");
  } catch (error) {
    console.error("[CacheService] Error caching last workout:", error);
  }
};

export const getCachedLastWorkout = async (): Promise<WorkoutHistory | null> => {
  try {
    const isValid = await isCacheValid(
      CACHE_KEYS.LAST_WORKOUT,
      CACHE_EXPIRY.LAST_WORKOUT
    );
    if (!isValid) {
      console.log(" [CacheService] Last workout cache expired");
      return null;
    }

    const data = await AsyncStorage.getItem(CACHE_KEYS.LAST_WORKOUT);
    if (data) {
      const workout = JSON.parse(data);
      // Convert date string back to Date object
      if (workout.date) {
        workout.date = new Date(workout.date);
      }
      return workout;
    }
    return null;
  } catch (error) {
    console.error("[CacheService] Error getting cached last workout:", error);
    return null;
  }
};

// ==================== WORKOUT PLAN ====================
export const cacheWorkoutPlan = async (plan: WorkoutPlan | null): Promise<void> => {
  try {
    if (!plan) {
      // If plan is null, remove from cache
      await AsyncStorage.removeItem(CACHE_KEYS.WORKOUT_PLAN);
      console.log(" [CacheService] Workout plan removed from cache");
      return;
    }
    await AsyncStorage.setItem(CACHE_KEYS.WORKOUT_PLAN, JSON.stringify(plan));
    await setCacheTimestamp(CACHE_KEYS.WORKOUT_PLAN);
    console.log(" [CacheService] Workout plan cached");
  } catch (error) {
    console.error("[CacheService] Error caching workout plan:", error);
  }
};

export const getCachedWorkoutPlan = async (): Promise<WorkoutPlan | null> => {
  try {
    const isValid = await isCacheValid(
      CACHE_KEYS.WORKOUT_PLAN,
      CACHE_EXPIRY.WORKOUT_PLAN
    );
    if (!isValid) {
      console.log(" [CacheService] Workout plan cache expired");
      return null;
    }

    const data = await AsyncStorage.getItem(CACHE_KEYS.WORKOUT_PLAN);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("[CacheService] Error getting cached workout plan:", error);
    return null;
  }
};

// ==================== NUTRITION ====================
const getNutritionCacheKey = (date: Date): string => {
  const d = new Date(date);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
  return `${CACHE_KEYS.NUTRITION_PREFIX}${dateStr}`;
};

export const cacheNutritionDay = async (
  date: Date,
  nutrition: DailyNutrition
): Promise<void> => {
  try {
    //  Check if nutrition is valid
    if (!nutrition) {
      console.log(" [CacheService] Cannot cache null/undefined nutrition");
      return;
    }

    const key = getNutritionCacheKey(date);
    
    //  Convert date to a serializable format
    const nutritionToCache = {
      ...nutrition,
      date: nutrition.date instanceof Date 
        ? nutrition.date.toISOString() 
        : nutrition.date,
    };

    await AsyncStorage.setItem(key, JSON.stringify(nutritionToCache));
    await setCacheTimestamp(key);
    console.log(" [CacheService] Nutrition cached for:", key);
  } catch (error) {
    console.error("[CacheService] Error caching nutrition:", error);
  }
};

export const getCachedNutritionDay = async (
  date: Date
): Promise<DailyNutrition | null> => {
  try {
    const key = getNutritionCacheKey(date);
    const isValid = await isCacheValid(key, CACHE_EXPIRY.NUTRITION);

    if (!isValid) {
      console.log("⚠️ [CacheService] Nutrition cache expired for:", key);
      return null;
    }

    const data = await AsyncStorage.getItem(key);
    if (data) {
      const nutrition = JSON.parse(data);
      // Convert date string back to Date object
      if (nutrition.date) {
        nutrition.date = new Date(nutrition.date);
      }
      return nutrition;
    }
    return null;
  } catch (error) {
    console.error("[CacheService] Error getting cached nutrition:", error);
    return null;
  }
};

// ==================== CACHE FOR WEEK ====================
/**
 * Cache nutrition data for multiple days
 * @param weekData - Array of DailyNutrition objects
 */
export const cacheNutritionWeek = async (
  weekData: DailyNutrition[]
): Promise<void> => {
  try {
    if (!weekData || weekData.length === 0) {
      console.log("⚠️ [CacheService] No week data to cache");
      return;
    }

    for (const nutrition of weekData) {
      //  Check if nutrition and date are valid
      if (nutrition && nutrition.date) {
        const date = nutrition.date instanceof Date 
          ? nutrition.date 
          : new Date(nutrition.date);
        
        await cacheNutritionDay(date, nutrition);
      }
    }
    console.log(`[CacheService] Week nutrition cached (${weekData.length} days)`);
  } catch (error) {
    console.error("[CacheService] Error caching week nutrition:", error);
  }
};

export const getCachedNutritionForDate = async (
  date: Date
): Promise<DailyNutrition | null> => {
  return getCachedNutritionDay(date);
};

// ==================== FOOD CACHE (for quick search) ====================
type CachedFood = Food & {
  cachedAt: number;
};

export const addFoodToCache = async (food: Food): Promise<void> => {
  try {
    if (!food || !food.name) {
      return;
    }

    const existingData = await AsyncStorage.getItem(CACHE_KEYS.FOOD_CACHE);
    const foods: CachedFood[] = existingData ? JSON.parse(existingData) : [];

    // Check if the food already exists
    const existingIndex = foods.findIndex(
      (f) => f.name.toLowerCase() === food.name.toLowerCase()
    );

    const cachedFood: CachedFood = {
      ...food,
      cachedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      // Update existing food
      foods[existingIndex] = cachedFood;
    } else {
      // Add new food
      foods.unshift(cachedFood);
    }

    // Keep only the last 100 foods
    const trimmedFoods = foods.slice(0, 100);

    await AsyncStorage.setItem(
      CACHE_KEYS.FOOD_CACHE,
      JSON.stringify(trimmedFoods)
    );
  } catch (error) {
    console.error("[CacheService] Error adding food to cache:", error);
  }
};

export const getCachedFoods = async (): Promise<Food[]> => {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEYS.FOOD_CACHE);
    if (!data) return [];

    const foods: CachedFood[] = JSON.parse(data);

    // filtrează alimentele expirate
    const validFoods = foods.filter(
      (f) => Date.now() - f.cachedAt < CACHE_EXPIRY.FOOD_CACHE
    );

    return validFoods;
  } catch (error) {
    console.error("[CacheService] Error getting cached foods:", error);
    return [];
  }
};

export const searchCachedFoods = async (query: string): Promise<Food[]> => {
  try {
    const foods = await getCachedFoods();
    const lowerQuery = query.toLowerCase();

    return foods.filter((food) =>
      food.name.toLowerCase().includes(lowerQuery)
    );
  } catch (error) {
    console.error("[CacheService] Error searching cached foods:", error);
    return [];
  }
};

// ==================== CLEANUP ====================
export const clearExpiredCache = async (): Promise<void> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const nutritionKeys = allKeys.filter((key) =>
      key.startsWith(CACHE_KEYS.NUTRITION_PREFIX)
    );

    let removedCount = 0;
    for (const key of nutritionKeys) {
      const isValid = await isCacheValid(key, CACHE_EXPIRY.NUTRITION);
      if (!isValid) {
        await AsyncStorage.removeItem(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 [CacheService] Removed ${removedCount} expired cache entries`);
    }
  } catch (error) {
    console.error("[CacheService] Error clearing expired cache:", error);
  }
};

export const clearAllCache = async (): Promise<void> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(
      (key) =>
        key.startsWith("cached_") ||
        key.startsWith(CACHE_KEYS.NUTRITION_PREFIX)
    );

    await AsyncStorage.multiRemove(cacheKeys);
    console.log("🧹 [CacheService] All cache cleared");
  } catch (error) {
    console.error("[CacheService] Error clearing all cache:", error);
  }
};

// ==================== CACHE SIZE ====================
export const getCacheSize = async (): Promise<{
  items: number;
  sizeKB: number;
}> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(
      (key) =>
        key.startsWith("cached_") ||
        key.startsWith(CACHE_KEYS.NUTRITION_PREFIX)
    );

    let totalSize = 0;
    for (const key of cacheKeys) {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        totalSize += value.length;
      }
    }

    return {
      items: cacheKeys.length,
      sizeKB: Math.round(totalSize / 1024),
    };
  } catch {
    return { items: 0, sizeKB: 0 };
  }
};