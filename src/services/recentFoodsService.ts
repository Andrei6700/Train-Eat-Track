import { firestore } from "@/src/config/firebase";
import { Food, ResponseType } from "@/src/types/index";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import NetInfo from "@react-native-community/netinfo";
import {
  addToSyncQueue,
  getOfflineRecentFoodsByMeal,
  saveOfflineRecentFood,
} from "./syncQueueService";

const COLLECTION_NAME = "recentFoods";

// check it the user it s online
const isOnline = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  } catch {
    return false;
  }
};

/**
 * Adds a food item to the recent history for a specific meal
 */
export const addRecentFood = async (
  userID: string,
  mealName: string,
  food: Food
): Promise<ResponseType> => {
  try {
    const online = await isOnline();

    //  Always save locally for quick access
    await saveOfflineRecentFood(userID, mealName, food);

    if (!online) {
      // Add to sync queue
      await addToSyncQueue({
        type: "ADD_RECENT_FOOD",
        data: { userID, mealName, food },
      });
      console.log(" [RecentFoods] Saved offline");
      return { success: true };
    }

    // Online - save to Firebase
    await addDoc(collection(firestore, COLLECTION_NAME), {
      userID,
      mealName,
      food,
      timestamp: serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error("[RecentFoodsService] Error adding recent food:", error);
    // Save offline in case of error
    await saveOfflineRecentFood(userID, mealName, food);
    return { success: true }; // Return success for UX
  }
};

/**
 * Gets the most recent foods added for a specific meal
 */
export const getRecentFoodsByMeal = async (
  userID: string,
  mealName: string,
  limitCount: number = 10
): Promise<ResponseType> => {
  try {
    const online = await isOnline();

    //  Always load offline data as well
    const offlineFoods = await getOfflineRecentFoodsByMeal(userID, mealName);

    if (!online) {
      console.log("⚠️ [RecentFoods] Offline - using local data");
      return { success: true, data: offlineFoods };
    }

    // Online - load from Firebase
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      where("mealName", "==", mealName),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    const firebaseFoods: Food[] = [];

    const seenFoodNames = new Set<string>();

    // Add offline foods first
    offlineFoods.forEach((food) => {
      const foodName = food.name.toLowerCase();
      if (!seenFoodNames.has(foodName)) {
        seenFoodNames.add(foodName);
        firebaseFoods.push(food);
      }
    });

    // Then add foods from Firebase
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const foodName = data.food.name.toLowerCase();

      if (!seenFoodNames.has(foodName)) {
        seenFoodNames.add(foodName);
        firebaseFoods.push(data.food as Food);
      }
    });

    return { success: true, data: firebaseFoods.slice(0, limitCount) };
  } catch (error: any) {
    console.error("[RecentFoodsService] Error getting recent foods:", error);

    // Fallback to offline data
    const offlineFoods = await getOfflineRecentFoodsByMeal(userID, mealName);
    return { success: true, data: offlineFoods };
  }
};