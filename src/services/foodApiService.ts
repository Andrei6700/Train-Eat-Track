import { auth } from "@/src/config/firebase";
import { addFoodsToCache } from "@/src/services/cacheService";
import {
  saveCustomProduct,
  searchCustomProductByBarcode,
  searchCustomProducts,
  toSimplifiedFromCustom,
} from "@/src/services/customProductService";
import {
  searchByBarcode as searchFoodByBarcodeInProvider,
  searchFoods as searchFoodsInProvider,
} from "@/src/services/nutritionixService";
import { Food, ResponseType } from "@/src/types/index";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES = 2;
const DEFAULT_SEARCH_PAGE = 1;
const DEFAULT_SEARCH_PAGE_SIZE = 20;
const DEFAULT_HYBRID_PAGE_SIZE = 12;
const DEFAULT_HYBRID_TIMEOUT_MS = 6000;
const DEFAULT_HYBRID_RETRIES = 0;
const DEFAULT_QUERY_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_RESULTS = 20;
const REMOTE_QUERY_CACHE_MAX_SIZE = 50;

type RemoteQueryCacheEntry = {
  createdAt: number;
  results: SimplifiedFood[];
};

const remoteQueryCache = new Map<string, RemoteQueryCacheEntry>();
const REMOTE_QUERY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Evict oldest entries when cache exceeds max size, and remove expired entries
const evictRemoteQueryCache = () => {
  const now = Date.now();
  // First, remove expired entries
  for (const [key, entry] of remoteQueryCache.entries()) {
    if (now - entry.createdAt >= REMOTE_QUERY_CACHE_TTL_MS) {
      remoteQueryCache.delete(key);
    }
  }

  // Then, if still over size limit, evict oldest entries
  if (remoteQueryCache.size <= REMOTE_QUERY_CACHE_MAX_SIZE) return;
  const entries = [...remoteQueryCache.entries()].sort(
    (a, b) => a[1].createdAt - b[1].createdAt,
  );
  const toRemove = entries.length - REMOTE_QUERY_CACHE_MAX_SIZE;
  for (let i = 0; i < toRemove; i++) {
    remoteQueryCache.delete(entries[i][0]);
  }
};

// ==================== BARCODE CACHE ====================
const BARCODE_MEMORY_TTL_MS = 30 * 60 * 1000; // 30 minutes
const BARCODE_DISK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const BARCODE_CACHE_PREFIX = "barcode_cache_";

type BarcodeCacheEntry = {
  result: ResponseType;
  cachedAt: number;
};

const barcodeMemoryCache = new Map<string, BarcodeCacheEntry>();

const getBarcodeDiskCacheKey = (barcode: string): string =>
  `${BARCODE_CACHE_PREFIX}${barcode}`;

const readBarcodeDiskCache = async (
  barcode: string,
): Promise<ResponseType | null> => {
  try {
    const raw = await AsyncStorage.getItem(getBarcodeDiskCacheKey(barcode));
    if (!raw) return null;
    const entry: BarcodeCacheEntry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt >= BARCODE_DISK_TTL_MS) return null;
    return entry.result;
  } catch {
    return null;
  }
};

const writeBarcodeDiskCache = (barcode: string, result: ResponseType): void => {
  (async () => {
    try {
      const entry: BarcodeCacheEntry = { result, cachedAt: Date.now() };
      await AsyncStorage.setItem(
        getBarcodeDiskCacheKey(barcode),
        JSON.stringify(entry),
      );
    } catch (error) {
      // Log cache write failures in dev mode but don't crash
      if (__DEV__) {
        console.warn("[FoodAPI] Failed to write barcode cache:", error);
      }
    }
  })();
};

export type SimplifiedFood = {
  code: string;
  product_name: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  brands?: string;
  image?: string;
};

export type SearchFoodOptions = {
  page?: number;
  pageSize?: number;
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
};

export type FoodSearchSource = "local" | "remote" | "mixed";

export type HybridFoodSearchResult = {
  foods: SimplifiedFood[];
  source: FoodSearchSource;
  localCount: number;
  remoteCount: number;
  fromQueryCache: boolean;
};

export type SearchFoodHybridContext = {
  localFoods?: Food[];
  includeRemote?: boolean;
  signal?: AbortSignal;
  remoteOptions?: SearchFoodOptions;
  queryCacheTtlMs?: number;
  maxResults?: number;
};

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

// Strip diacritics (Romanian: ăâîșț etc.) for better matching
const stripDiacritics = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const normalizeText = (value: string): string =>
  stripDiacritics(value.trim().toLowerCase());
const normalizeBarcode = (value: string): string =>
  value.trim().replace(/[^\d]/g, "");

const foodIdentity = (food: SimplifiedFood): string => {
  if (food.code && !food.code.startsWith("local-")) {
    return `code:${food.code}`;
  }
  return `name:${normalizeText(food.name || food.product_name || "")}`;
};

const mergeUniqueFoods = (
  first: SimplifiedFood[],
  second: SimplifiedFood[],
  maxResults: number,
): SimplifiedFood[] => {
  const merged: SimplifiedFood[] = [];
  const seen = new Set<string>();

  const addItems = (items: SimplifiedFood[]) => {
    for (const item of items) {
      if (merged.length >= maxResults) return;
      const id = foodIdentity(item);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(item);
    }
  };

  addItems(first);
  addItems(second);

  return merged;
};

const toSearchOptions = (
  pageOrOptions: number | SearchFoodOptions | undefined,
  pageSize: number | undefined,
): Required<Omit<SearchFoodOptions, "signal">> & Pick<SearchFoodOptions, "signal"> => {
  if (typeof pageOrOptions === "number" || pageOrOptions === undefined) {
    return {
      page: pageOrOptions ?? DEFAULT_SEARCH_PAGE,
      pageSize: pageSize ?? DEFAULT_SEARCH_PAGE_SIZE,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      retries: DEFAULT_RETRIES,
      signal: undefined,
    };
  }

  return {
    page: pageOrOptions.page ?? DEFAULT_SEARCH_PAGE,
    pageSize: pageOrOptions.pageSize ?? DEFAULT_SEARCH_PAGE_SIZE,
    timeoutMs: pageOrOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retries: pageOrOptions.retries ?? DEFAULT_RETRIES,
    signal: pageOrOptions.signal,
  };
};

const toSimplifiedFromLocalFood = (food: Food): SimplifiedFood => {
  const normalizedName = normalizeText(food.name);
  return {
    code: `local-${normalizedName}`,
    product_name: food.name,
    name: food.name,
    calories: Number(food.calories) || 0,
    protein: Number(food.protein) || 0,
    carbs: Number(food.carbs) || 0,
    fat: Number(food.fat) || 0,
    servingSize: food.servingSize || "100g",
  };
};

// Score a food name against a query using word-based matching.
// Returns 0 for no match, higher scores for better matches.
const scoreFoodMatch = (foodName: string, queryWords: string[]): number => {
  let score = 0;
  for (const word of queryWords) {
    if (foodName.includes(word)) {
      // Exact word inclusion
      score += word.length * 2;
      // Bonus for starting with the word
      if (foodName.startsWith(word)) score += 3;
    } else {
      // Check if any word in the food name starts with the query word (prefix match)
      const foodWords = foodName.split(/\s+/);
      let prefixMatch = false;
      for (const fw of foodWords) {
        if (fw.startsWith(word) && word.length >= 2) {
          score += word.length;
          prefixMatch = true;
          break;
        }
      }
      if (!prefixMatch) return 0; // All query words must match
    }
  }
  return score;
};

const getLocalMatches = (
  query: string,
  localFoods: Food[],
  maxResults: number,
): SimplifiedFood[] => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery || localFoods.length === 0) return [];

  const queryWords = normalizedQuery.split(/\s+/).filter((w) => w.length >= 1);
  if (queryWords.length === 0) return [];

  const scored: { food: Food; score: number }[] = [];
  for (const food of localFoods) {
    const normalizedName = normalizeText(food.name);
    const score = scoreFoodMatch(normalizedName, queryWords);
    if (score > 0) {
      scored.push({ food, score });
    }
  }

  // Sort by score descending for best matches first
  scored.sort((a, b) => b.score - a.score);

  const localResults = scored
    .slice(0, maxResults)
    .map(({ food }) => toSimplifiedFromLocalFood(food));

  return mergeUniqueFoods(localResults, [], maxResults);
};

const toFoodCachePayload = (food: SimplifiedFood): Food => ({
  name: food.name,
  calories: food.calories,
  protein: food.protein,
  carbs: food.carbs,
  fat: food.fat,
  servingSize: food.servingSize || "100g",
});

const cacheRemoteFoods = (foods: SimplifiedFood[]) => {
  if (foods.length === 0) return;

  (async () => {
    try {
      const batch = foods.slice(0, 8).map(toFoodCachePayload);
      await addFoodsToCache(batch);
    } catch (error) {
      if (__DEV__) {
        console.warn("[FoodAPI] Error caching remote foods:", error);
      }
    }
  })();
};

/**
 * Search for foods in USDA FoodData Central.
 * Backward compatible: `searchFood(query, page, pageSize)` still works.
 */
export const searchFood = async (
  query: string,
  pageOrOptions: number | SearchFoodOptions = DEFAULT_SEARCH_PAGE,
  pageSize = DEFAULT_SEARCH_PAGE_SIZE,
): Promise<SimplifiedFood[]> => {
  const options = toSearchOptions(pageOrOptions, pageSize);

  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const providerResults = await searchFoodsInProvider(query.trim(), {
      page: options.page,
      pageSize: options.pageSize,
      timeoutMs: options.timeoutMs,
      retries: options.retries,
      signal: options.signal,
    });

    const simplifiedFoods: SimplifiedFood[] = providerResults.map((item) => ({
      code: item.code,
      product_name: item.product_name,
      name: item.name,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      servingSize: item.servingSize,
      brands: item.brands,
    }));

    if (__DEV__) {
      console.log(`[FoodAPI] USDA search found ${simplifiedFoods.length} products`);
    }
    return simplifiedFoods;
  } catch (error: any) {
    if (isAbortError(error) && options.signal?.aborted) {
      throw error;
    }

    if (isAbortError(error)) {
      if (__DEV__) {
        console.error("[FoodAPI] Request timeout");
      }
    } else {
      if (__DEV__) {
        console.error("[FoodAPI] Search error:", error?.message || error);
      }
    }

    return [];
  }
};

export const searchFoodHybrid = async (
  query: string,
  context: SearchFoodHybridContext = {},
): Promise<HybridFoodSearchResult> => {
  const normalizedQuery = normalizeText(query);
  const includeRemote = context.includeRemote ?? true;
  const maxResults = context.maxResults ?? DEFAULT_MAX_RESULTS;
  const queryCacheTtlMs = context.queryCacheTtlMs ?? DEFAULT_QUERY_CACHE_TTL_MS;

  if (!normalizedQuery || normalizedQuery.length < 2) {
    return {
      foods: [],
      source: "local",
      localCount: 0,
      remoteCount: 0,
      fromQueryCache: false,
    };
  }

  // Get local matches from Firebase
  const localResults = getLocalMatches(
    normalizedQuery,
    context.localFoods || [],
    maxResults,
  );

  // Get custom products from Firebase
  const customProducts = await searchCustomProducts(normalizedQuery);
  const customResults = customProducts
    .slice(0, maxResults)
    .map(toSimplifiedFromCustom);

  if (!includeRemote) {
    const merged = mergeUniqueFoods(localResults, customResults, maxResults);
    return {
      foods: merged,
      source:
        localResults.length > 0 && customResults.length > 0
          ? "mixed"
          : customResults.length > 0
            ? "remote"
            : "local",
      localCount: localResults.length,
      remoteCount: customResults.length,
      fromQueryCache: false,
    };
  }

  const cachedRemote = remoteQueryCache.get(normalizedQuery);
  const hasFreshRemoteCache =
    Boolean(cachedRemote) &&
    Date.now() - (cachedRemote?.createdAt || 0) < queryCacheTtlMs;

  if (hasFreshRemoteCache && cachedRemote) {
    const merged = mergeUniqueFoods(
      localResults,
      mergeUniqueFoods(customResults, cachedRemote.results, maxResults),
      maxResults,
    );
    return {
      foods: merged,
      source:
        localResults.length > 0 && cachedRemote.results.length > 0
          ? "mixed"
          : cachedRemote.results.length > 0
            ? "remote"
            : "local",
      localCount: localResults.length,
      remoteCount: cachedRemote.results.length + customResults.length,
      fromQueryCache: true,
    };
  }

  const remoteOptions: SearchFoodOptions = {
    page: context.remoteOptions?.page ?? DEFAULT_SEARCH_PAGE,
    pageSize: context.remoteOptions?.pageSize ?? DEFAULT_HYBRID_PAGE_SIZE,
    timeoutMs: context.remoteOptions?.timeoutMs ?? DEFAULT_HYBRID_TIMEOUT_MS,
    retries: context.remoteOptions?.retries ?? DEFAULT_HYBRID_RETRIES,
    signal: context.signal || context.remoteOptions?.signal,
  };

  const remoteResults = await searchFood(normalizedQuery, remoteOptions);

  remoteQueryCache.set(normalizedQuery, {
    createdAt: Date.now(),
    results: remoteResults,
  });
  evictRemoteQueryCache();

  cacheRemoteFoods(remoteResults);

  const merged = mergeUniqueFoods(
    localResults,
    mergeUniqueFoods(customResults, remoteResults, maxResults),
    maxResults,
  );
  return {
    foods: merged,
    source:
      localResults.length > 0 && remoteResults.length > 0
        ? "mixed"
        : remoteResults.length > 0
          ? "remote"
          : "local",
    localCount: localResults.length,
    remoteCount: remoteResults.length + customResults.length,
    fromQueryCache: false,
  };
};

/**
 * Get food details by barcode using:
 * 1. in-memory cache
 * 2. disk cache
 * 3. Firebase custom products
 * 4. USDA API fallback
 */
export const getFoodByBarcode = async (barcode: string): Promise<ResponseType> => {
  const normalizedBarcode = normalizeBarcode(barcode);
  if (!normalizedBarcode) {
    return { success: false, msg: "Invalid barcode" };
  }

  const memEntry = barcodeMemoryCache.get(normalizedBarcode);
  if (memEntry && Date.now() - memEntry.cachedAt < BARCODE_MEMORY_TTL_MS) {
    return memEntry.result;
  }

  const diskResult = await readBarcodeDiskCache(normalizedBarcode);
  if (diskResult) {
    barcodeMemoryCache.set(normalizedBarcode, {
      result: diskResult,
      cachedAt: Date.now(),
    });
    return diskResult;
  }

  const customProduct = await searchCustomProductByBarcode(normalizedBarcode);
  if (customProduct) {
    const simplifiedFood = toSimplifiedFromCustom(customProduct);
    const successResult: ResponseType = { success: true, data: simplifiedFood };

    barcodeMemoryCache.set(normalizedBarcode, {
      result: successResult,
      cachedAt: Date.now(),
    });
    writeBarcodeDiskCache(normalizedBarcode, successResult);

    if (__DEV__) {
      console.log("[FoodAPI] Found product in Firebase customProducts");
    }
    return successResult;
  }

  try {
    const providerFood = await searchFoodByBarcodeInProvider(normalizedBarcode, {
      timeoutMs: DEFAULT_TIMEOUT_MS,
      retries: DEFAULT_RETRIES,
    });

    if (!providerFood) {
      return { success: false, msg: "Product not found in database" };
    }

    const simplifiedFood: SimplifiedFood = {
      code: providerFood.code,
      product_name: providerFood.product_name,
      name: providerFood.name,
      calories: providerFood.calories,
      protein: providerFood.protein,
      carbs: providerFood.carbs,
      fat: providerFood.fat,
      servingSize: providerFood.servingSize,
      brands: providerFood.brands,
      image: providerFood.image,
    };

    const successResult: ResponseType = { success: true, data: simplifiedFood };

    barcodeMemoryCache.set(normalizedBarcode, {
      result: successResult,
      cachedAt: Date.now(),
    });
    writeBarcodeDiskCache(normalizedBarcode, successResult);

    const currentUserId = auth.currentUser?.uid;
    if (currentUserId) {
      void saveCustomProduct(currentUserId, {
        barcode: normalizedBarcode,
        name: simplifiedFood.name,
        brand: simplifiedFood.brands,
        calories: simplifiedFood.calories,
        protein: simplifiedFood.protein,
        carbs: simplifiedFood.carbs,
        fat: simplifiedFood.fat,
        servingSize: simplifiedFood.servingSize,
        source: "api",
      });
    }

    return successResult;
  } catch (error: any) {
    if (isAbortError(error)) {
      if (__DEV__) {
        console.error("[FoodAPI] Barcode request timeout");
      }
      return { success: false, msg: "Request timeout - please try again" };
    }

    if (__DEV__) {
      console.error("[FoodAPI] Barcode search error:", error?.message || error);
    }
    return { success: false, msg: error?.message || "Error fetching product" };
  }
};

// Food suggestions by category
export const getFoodSuggestions = (
  category: "protein" | "carbs" | "snacks" | "breakfast",
): string[] => {
  const suggestions = {
    protein: [
      "chicken breast",
      "salmon",
      "eggs",
      "greek yogurt",
      "protein powder",
      "tuna",
      "beef",
    ],
    carbs: [
      "rice",
      "pasta",
      "bread",
      "oats",
      "potato",
      "quinoa",
      "sweet potato",
    ],
    snacks: [
      "almonds",
      "peanut butter",
      "protein bar",
      "apple",
      "banana",
      "crackers",
    ],
    breakfast: [
      "oatmeal",
      "cereal",
      "pancakes",
      "eggs",
      "yogurt",
      "toast",
      "milk",
    ],
  };

  return suggestions[category] || [];
};
