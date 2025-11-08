import { firestore } from "@/src/config/firebase";
import { Food, ResponseType } from '@/src/types/index';
import {
    addDoc,
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    where
} from "firebase/firestore";

const COLLECTION_NAME = "recentFoods";

/**
 * Adaugă un aliment în istoricul recent pentru o masă specifică
 */
export const addRecentFood = async (
    userID: string,
    mealName: string,
    food: Food
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
        console.error("[RecentFoodsService] Error adding recent food:", error);
        return { success: false, msg: error?.message };
    }
};

/**
 * Obține ultimele alimente adăugate pentru o masă specifică
 */
export const getRecentFoodsByMeal = async (
    userID: string,
    mealName: string,
    limitCount: number = 10
): Promise<ResponseType> => {
    try {
        const q = query(
            collection(firestore, COLLECTION_NAME),
            where("userID", "==", userID),
            where("mealName", "==", mealName),
            orderBy("timestamp", "desc"),
            limit(limitCount)
        );

        const querySnapshot = await getDocs(q);
        const recentFoods: Food[] = [];

        // Folosim un Set pentru a evita duplicatele
        const seenFoodNames = new Set<string>();

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const foodName = data.food.name.toLowerCase();

            // Adăugăm doar dacă nu am văzut deja acest aliment
            if (!seenFoodNames.has(foodName)) {
                seenFoodNames.add(foodName);
                recentFoods.push(data.food as Food);
            }
        });

        return { success: true, data: recentFoods };
    } catch (error: any) {
        console.error("[RecentFoodsService] Error fetching recent foods:", error);
        return { success: false, msg: error?.message };
    }
};