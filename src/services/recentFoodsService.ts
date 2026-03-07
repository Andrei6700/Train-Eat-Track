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
  enqueueOrMergeAction,
  getOfflineRecentFoodsByMeal,
  saveOfflineRecentFood,
} from "./syncQueueService";

const COLLECTION_NAME = "recentFoods";

const isOnline = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  } catch {
    return false;
  }
};

export const addRecentFoodRemote = async (
  userID: string,
  mealName: string,
  food: Food,
): Promise<ResponseType> => {
  try {
    await addDoc(collection(firestore, COLLECTION_NAME), {
      userID,
      mealName,
      food,
      timestamp: serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error("[RecentFoodsService] Error adding recent food remotely:", error);
    return { success: false, msg: error?.message, code: "UNKNOWN_ERROR" };
  }
};

export const addRecentFood = async (
  userID: string,
  mealName: string,
  food: Food,
): Promise<ResponseType> => {
  try {
    await saveOfflineRecentFood(userID, mealName, food);

    const online = await isOnline();

    if (!online) {
      await enqueueOrMergeAction({
        type: "ADD_RECENT_FOOD",
        data: { userID, mealName, food },
        mergeStrategy: "append",
      });

      return {
        success: true,
        code: "SYNC_QUEUED_OFFLINE",
      };
    }

    const remoteResult = await addRecentFoodRemote(userID, mealName, food);
    if (remoteResult.success) {
      return remoteResult;
    }

    await enqueueOrMergeAction({
      type: "ADD_RECENT_FOOD",
      data: { userID, mealName, food },
      mergeStrategy: "append",
    });

    return {
      success: true,
      code: "SYNC_RETRY_SCHEDULED",
      msg: "Recent food saved locally and queued for sync.",
    };
  } catch (error: any) {
    console.error("[RecentFoodsService] Error adding recent food:", error);

    await saveOfflineRecentFood(userID, mealName, food);
    await enqueueOrMergeAction({
      type: "ADD_RECENT_FOOD",
      data: { userID, mealName, food },
      mergeStrategy: "append",
    });

    return {
      success: true,
      code: "SYNC_RETRY_SCHEDULED",
      msg: "Recent food saved locally and queued for sync.",
    };
  }
};

export const getRecentFoodsByMeal = async (
  userID: string,
  mealName: string,
  limitCount: number = 10,
): Promise<ResponseType> => {
  try {
    const online = await isOnline();
    const offlineFoods = await getOfflineRecentFoodsByMeal(userID, mealName);

    if (!online) {
      return { success: true, data: offlineFoods };
    }

    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userID", "==", userID),
      where("mealName", "==", mealName),
      orderBy("timestamp", "desc"),
      limit(limitCount),
    );

    const querySnapshot = await getDocs(q);
    const mergedFoods: Food[] = [];
    const seenFoodNames = new Set<string>();

    offlineFoods.forEach((food) => {
      const foodName = food.name.toLowerCase();
      if (!seenFoodNames.has(foodName)) {
        seenFoodNames.add(foodName);
        mergedFoods.push(food);
      }
    });

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const foodName = data.food?.name?.toLowerCase?.() || "";
      if (foodName && !seenFoodNames.has(foodName)) {
        seenFoodNames.add(foodName);
        mergedFoods.push(data.food as Food);
      }
    });

    return { success: true, data: mergedFoods.slice(0, limitCount) };
  } catch (error: any) {
    console.error("[RecentFoodsService] Error getting recent foods:", error);
    const offlineFoods = await getOfflineRecentFoodsByMeal(userID, mealName);
    return { success: true, data: offlineFoods };
  }
};
