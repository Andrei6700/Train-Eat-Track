import { addFoodsToCache } from "@/src/services/cacheService";
import { Food, ResponseType } from "@/src/types/index";
import AsyncStorage from "@react-native-async-storage/async-storage";

const OPEN_FOOD_FACTS_API = "https://world.openfoodfacts.org/cgi/search.pl";
const PRODUCT_API = "https://world.openfoodfacts.org/api/v2/product";

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

type FetchRetryConfig = {
  retries?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

type RemoteQueryCacheEntry = {
  createdAt: number;
  results: SimplifiedFood[];
};

const remoteQueryCache = new Map<string, RemoteQueryCacheEntry>();

// Evict oldest entries when cache exceeds max size
const evictRemoteQueryCache = () => {
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
  void (async () => {
    try {
      const entry: BarcodeCacheEntry = { result, cachedAt: Date.now() };
      await AsyncStorage.setItem(
        getBarcodeDiskCacheKey(barcode),
        JSON.stringify(entry),
      );
    } catch {
      // fire-and-forget
    }
  })();
};

export type OpenFoodFactsProduct = {
  code: string;
  product_name: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  nutriments?: {
    "energy-kcal_100g"?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    "energy-kcal_serving"?: number;
    proteins_serving?: number;
    carbohydrates_serving?: number;
    fat_serving?: number;
  };
  image_url?: string;
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

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

// Strip diacritics (Romanian: ăâîșț etc.) for better matching
const stripDiacritics = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const normalizeText = (value: string): string =>
  stripDiacritics(value.trim().toLowerCase());

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

  void (async () => {
    try {
      const batch = foods.slice(0, 8).map(toFoodCachePayload);
      await addFoodsToCache(batch);
    } catch (error) {
      console.error("[FoodAPI] Error caching remote foods:", error);
    }
  })();
};

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: FetchRetryConfig = {},
): Promise<Response> {
  const retries = config.retries ?? DEFAULT_RETRIES;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();

    if (config.signal) {
      if (config.signal.aborted) {
        controller.abort();
      } else {
        config.signal.addEventListener("abort", onCallerAbort);
      }
    }

    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      const abortedByCaller = Boolean(config.signal?.aborted);
      if (isAbortError(error) && abortedByCaller) {
        throw error;
      }

      if (attempt === retries) {
        throw error;
      }

      const waitMs = Math.min(1000 * Math.pow(2, attempt), 5000);
      console.log(`[FoodAPI] Retry ${attempt + 1}/${retries} after ${waitMs}ms`);
      await sleep(waitMs);
    } finally {
      clearTimeout(timeoutId);
      if (config.signal) {
        config.signal.removeEventListener("abort", onCallerAbort);
      }
    }
  }

  throw new Error("Max retries exceeded");
}

/**
 * Search for food in Open Food Facts database.
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

    const params = new URLSearchParams({
      search_terms: query.trim(),
      search_simple: "1",
      action: "process",
      page: options.page.toString(),
      page_size: options.pageSize.toString(),
      json: "1",
      fields: "code,product_name,brands,quantity,serving_size,nutriments,image_url",
    });

    const url = `${OPEN_FOOD_FACTS_API}?${params.toString()}`;
    console.log("[FoodAPI] Searching:", url);

    const response = await fetchWithRetry(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": "FitnessApp/1.0 (fitness.app@example.com)",
          Accept: "application/json",
        },
      },
      {
        retries: options.retries,
        timeoutMs: options.timeoutMs,
        signal: options.signal,
      },
    );

    if (!response.ok) {
      console.error("[FoodAPI] Error response:", response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    if (!data.products || data.products.length === 0) {
      return [];
    }

    const simplifiedFoods: SimplifiedFood[] = data.products
      .filter((product: OpenFoodFactsProduct) => {
        return (
          product.nutriments &&
          (product.nutriments["energy-kcal_100g"] ||
            product.nutriments["energy-kcal_serving"])
        );
      })
      .map((product: OpenFoodFactsProduct) => {
        const nutriments = product.nutriments || {};
        // Prefer per-100g values for consistency with quantity multiplier
        const calories =
          nutriments["energy-kcal_100g"] ||
          nutriments["energy-kcal_serving"] ||
          0;
        const protein =
          nutriments.proteins_100g || nutriments.proteins_serving || 0;
        const carbs =
          nutriments.carbohydrates_100g || nutriments.carbohydrates_serving || 0;
        const fat = nutriments.fat_100g || nutriments.fat_serving || 0;

        let servingSize = "100g";
        if (product.serving_size) {
          servingSize = product.serving_size;
        } else if (product.quantity) {
          servingSize = product.quantity;
        }

        return {
          code: product.code,
          product_name: product.product_name || "Unknown Product",
          name: product.product_name || "Unknown Product",
          calories: Math.round(calories),
          protein: Math.round(protein * 10) / 10,
          carbs: Math.round(carbs * 10) / 10,
          fat: Math.round(fat * 10) / 10,
          servingSize,
          brands: product.brands,
          image: product.image_url,
        };
      });

    console.log(`[FoodAPI] Found ${simplifiedFoods.length} products`);
    return simplifiedFoods;
  } catch (error: any) {
    if (isAbortError(error) && options.signal?.aborted) {
      throw error;
    }

    if (isAbortError(error)) {
      console.error("[FoodAPI] Request timeout");
    } else {
      console.error("[FoodAPI] Search error:", error?.message || error);
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

  const localResults = getLocalMatches(
    normalizedQuery,
    context.localFoods || [],
    maxResults,
  );

  if (!includeRemote) {
    return {
      foods: localResults,
      source: "local",
      localCount: localResults.length,
      remoteCount: 0,
      fromQueryCache: false,
    };
  }

  const cachedRemote = remoteQueryCache.get(normalizedQuery);
  const hasFreshRemoteCache =
    Boolean(cachedRemote) &&
    Date.now() - (cachedRemote?.createdAt || 0) < queryCacheTtlMs;

  if (hasFreshRemoteCache && cachedRemote) {
    const mergedCached = mergeUniqueFoods(
      localResults,
      cachedRemote.results,
      maxResults,
    );
    return {
      foods: mergedCached,
      source:
        localResults.length > 0 && cachedRemote.results.length > 0
          ? "mixed"
          : cachedRemote.results.length > 0
            ? "remote"
            : "local",
      localCount: localResults.length,
      remoteCount: cachedRemote.results.length,
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

  const merged = mergeUniqueFoods(localResults, remoteResults, maxResults);
  return {
    foods: merged,
    source:
      localResults.length > 0 && remoteResults.length > 0
        ? "mixed"
        : remoteResults.length > 0
          ? "remote"
          : "local",
    localCount: localResults.length,
    remoteCount: remoteResults.length,
    fromQueryCache: false,
  };
};

/**
 * Get food details by barcode (with in-memory + disk cache)
 */
export const getFoodByBarcode = async (
  barcode: string,
): Promise<ResponseType> => {
  // Check in-memory cache
  const memEntry = barcodeMemoryCache.get(barcode);
  if (memEntry && Date.now() - memEntry.cachedAt < BARCODE_MEMORY_TTL_MS) {
    return memEntry.result;
  }

  // Check disk cache
  const diskResult = await readBarcodeDiskCache(barcode);
  if (diskResult) {
    barcodeMemoryCache.set(barcode, {
      result: diskResult,
      cachedAt: Date.now(),
    });
    return diskResult;
  }

  try {
    const url = `${PRODUCT_API}/${encodeURIComponent(barcode)}`;
    console.log("[FoodAPI] Fetching barcode:", url);

    const response = await fetchWithRetry(url, {
      method: "GET",
      headers: {
        "User-Agent": "FitnessApp/1.0 (fitness.app@example.com)",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error("[FoodAPI] Error response:", response.status);
      return { success: false, msg: "Product not found" };
    }

    const data = await response.json();

    if (data.status === 0 || !data.product) {
      return { success: false, msg: "Product not found in database" };
    }

    const product: OpenFoodFactsProduct = data.product;
    const nutriments = product.nutriments || {};

    const simplifiedFood: SimplifiedFood = {
      code: product.code,
      product_name: product.product_name || "Unknown Product",
      name: product.product_name || "Unknown Product",
      calories: Math.round(nutriments["energy-kcal_100g"] || 0),
      protein: Math.round((nutriments.proteins_100g || 0) * 10) / 10,
      carbs: Math.round((nutriments.carbohydrates_100g || 0) * 10) / 10,
      fat: Math.round((nutriments.fat_100g || 0) * 10) / 10,
      servingSize: product.serving_size || product.quantity || "100g",
      brands: product.brands,
      image: product.image_url,
    };

    const successResult: ResponseType = { success: true, data: simplifiedFood };

    // Populate both caches
    barcodeMemoryCache.set(barcode, {
      result: successResult,
      cachedAt: Date.now(),
    });
    writeBarcodeDiskCache(barcode, successResult);

    return successResult;
  } catch (error: any) {
    if (isAbortError(error)) {
      console.error("[FoodAPI] Barcode request timeout");
      return { success: false, msg: "Request timeout - please try again" };
    }
    console.error("[FoodAPI] Barcode search error:", error?.message || error);
    return { success: false, msg: error?.message || "Error fetching product" };
  }
};

/**
 * Food suggestions by category
 */
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
