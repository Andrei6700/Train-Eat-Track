import { auth, firestore } from "@/src/config/firebase";
import type { SimplifiedFood } from "@/src/services/foodApiService";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

const COLLECTION_NAME = "customProducts";
const REMOTE_TIMEOUT_MS = 8000;

export type CustomProductSource = "api" | "manual";

export type CustomProduct = {
  id: string;
  barcode: string;
  userId: string;
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  servingSize: string;
  image?: string;
  source: CustomProductSource;
  addedBy?: string;
  verified?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SaveCustomProductInput = {
  barcode: string;
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  servingSize: string;
  image?: string;
  source?: CustomProductSource;
};

const withTimeout = async <T>(
  promise: Promise<T>,
  operationName: string,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${operationName} timed out after ${REMOTE_TIMEOUT_MS}ms`));
        }, REMOTE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const normalizeBarcode = (barcode: string): string =>
  barcode.trim().replace(/[^\d]/g, "");

const parseTimestamp = (value: unknown, fallback: Date): Date => {
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }

  return fallback;
};

const parseCustomProductDoc = (id: string, payload: any): CustomProduct => {
  const fallbackDate = new Date();
  return {
    id,
    barcode: String(payload.barcode || ""),
    userId: String(payload.userId || ""),
    name: String(payload.name || "Unknown Product"),
    brand: payload.brand || undefined,
    calories: Number(payload.calories) || 0,
    protein: Number(payload.protein) || 0,
    carbs: Number(payload.carbs) || 0,
    fat: Number(payload.fat) || 0,
    fiber:
      payload.fiber === undefined || payload.fiber === null
        ? undefined
        : Number(payload.fiber) || 0,
    servingSize: String(payload.servingSize || "100g"),
    image: payload.image || undefined,
    source: payload.source === "api" ? "api" : "manual",
    createdAt: parseTimestamp(payload.createdAt, fallbackDate),
    updatedAt: parseTimestamp(payload.updatedAt, fallbackDate),
  };
};

const pickLatestDoc = (
  docs: { id: string; data: () => any }[],
): { id: string; data: () => any } => {
  let latest = docs[0];
  let latestTimestamp = parseTimestamp(latest.data().updatedAt, new Date(0)).getTime();

  for (let index = 1; index < docs.length; index += 1) {
    const current = docs[index];
    const currentTimestamp = parseTimestamp(
      current.data().updatedAt,
      new Date(0),
    ).getTime();
    if (currentTimestamp > latestTimestamp) {
      latest = current;
      latestTimestamp = currentTimestamp;
    }
  }

  return latest;
};

export const searchCustomProductByBarcode = async (
  barcode: string,
): Promise<CustomProduct | null> => {
  const normalizedBarcode = normalizeBarcode(barcode);
  if (!normalizedBarcode) return null;

  try {
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("barcode", "==", normalizedBarcode),
      limit(3),
    );
    const snapshot = await withTimeout(
      getDocs(q),
      "searchCustomProductByBarcode.getDocs",
    );

    if (snapshot.empty) {
      return null;
    }

    const latestDoc = pickLatestDoc(snapshot.docs);
    return parseCustomProductDoc(latestDoc.id, latestDoc.data());
  } catch (error) {
    if (__DEV__) {
      console.error("[CustomProductService] Barcode lookup failed:", error);
    }
    return null;
  }
};

export const getCustomProductByBarcode = searchCustomProductByBarcode;

export const saveCustomProduct = async (
  userId: string,
  input: SaveCustomProductInput,
): Promise<CustomProduct | null> => {
  if (!userId) {
    if (__DEV__) {
      console.warn("[CustomProductService] saveCustomProduct called without userId");
    }
    return null;
  }

  const normalizedBarcode = normalizeBarcode(input.barcode);
  if (!normalizedBarcode) {
    if (__DEV__) {
      console.warn("[CustomProductService] saveCustomProduct requires a barcode");
    }
    return null;
  }

  const now = new Date();
  const payload = {
    barcode: normalizedBarcode,
    userId,
    name: input.name.trim(),
    brand: input.brand?.trim() || null,
    calories: Math.max(0, Math.round(Number(input.calories) || 0)),
    protein: Math.max(0, Number(input.protein) || 0),
    carbs: Math.max(0, Number(input.carbs) || 0),
    fat: Math.max(0, Number(input.fat) || 0),
    fiber:
      input.fiber === undefined || input.fiber === null
        ? null
        : Math.max(0, Number(input.fiber) || 0),
    servingSize: input.servingSize.trim() || "100g",
    image: input.image || null,
    source: input.source || "manual",
  };

  try {
    const existing = await searchCustomProductByBarcode(normalizedBarcode);

    if (existing) {
      const ref = doc(firestore, COLLECTION_NAME, existing.id);
      await withTimeout(
        updateDoc(ref, {
          ...payload,
          updatedAt: serverTimestamp(),
        }),
        "saveCustomProduct.updateDoc",
      );

      return {
        ...existing,
        ...payload,
        brand: payload.brand || undefined,
        fiber: payload.fiber ?? undefined,
        image: payload.image || undefined,
        updatedAt: now,
      };
    }

    const docRef = await withTimeout(
      addDoc(collection(firestore, COLLECTION_NAME), {
        ...payload,
        addedBy: userId,
        verified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
      "saveCustomProduct.addDoc",
    );

    return {
      id: docRef.id,
      barcode: payload.barcode,
      userId: payload.userId,
      name: payload.name,
      brand: payload.brand || undefined,
      calories: payload.calories,
      protein: payload.protein,
      carbs: payload.carbs,
      fat: payload.fat,
      fiber: payload.fiber ?? undefined,
      servingSize: payload.servingSize,
      image: payload.image || undefined,
      source: payload.source,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    if (__DEV__) {
      console.error("[CustomProductService] Save failed:", error);
    }
    return null;
  }
};

export const getCustomProductsByUser = async (
  userId: string,
): Promise<CustomProduct[]> => {
  if (!userId) return [];

  try {
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userId", "==", userId),
      limit(200),
    );
    const snapshot = await withTimeout(
      getDocs(q),
      "getCustomProductsByUser.getDocs",
    );
    return snapshot.docs
      .map((docSnap) => parseCustomProductDoc(docSnap.id, docSnap.data()))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  } catch (error) {
    if (__DEV__) {
      console.error("[CustomProductService] getCustomProductsByUser failed:", error);
    }
    return [];
  }
};

export const searchCustomProducts = async (
  queryText: string,
): Promise<CustomProduct[]> => {
  const normalized = queryText.trim().toLowerCase();
  if (normalized.length < 2) return [];

  const currentUserId = auth.currentUser?.uid;
  if (!currentUserId) return [];

  try {
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where("userId", "==", currentUserId),
      limit(100),
    );
    const snapshot = await withTimeout(getDocs(q), "searchCustomProducts.getDocs");
    const all = snapshot.docs.map((docSnap) =>
      parseCustomProductDoc(docSnap.id, docSnap.data()),
    );

    return all
      .filter((item) => {
        const name = item.name.toLowerCase();
        const brand = item.brand?.toLowerCase() || "";
        return name.includes(normalized) || brand.includes(normalized);
      })
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .slice(0, 15);
  } catch (error) {
    if (__DEV__) {
      console.error("[CustomProductService] searchCustomProducts failed:", error);
    }
    return [];
  }
};

export const deleteCustomProduct = async (productId: string): Promise<boolean> => {
  if (!productId) return false;

  try {
    await withTimeout(
      deleteDoc(doc(firestore, COLLECTION_NAME, productId)),
      "deleteCustomProduct.deleteDoc",
    );
    return true;
  } catch (error) {
    if (__DEV__) {
      console.error("[CustomProductService] deleteCustomProduct failed:", error);
    }
    return false;
  }
};

export const toSimplifiedFromCustom = (product: CustomProduct): SimplifiedFood => ({
  code: `custom-${product.id}`,
  product_name: product.name,
  name: product.name,
  calories: product.calories,
  protein: product.protein,
  carbs: product.carbs,
  fat: product.fat,
  servingSize: product.servingSize,
  brands: product.brand,
  image: product.image,
});
