/**
 * foodProviderService.ts
 *
 * Multi-provider food search service.
 * Searches USDA FoodData Central + Open Food Facts in parallel.
 *
 * Previously named nutritionixService.ts — renamed to reflect
 * the actual providers used (USDA + OFF, not Nutritionix).
 *
 * NOTE: To fully protect the USDA API key, deploy the Cloud Function
 * in /functions/src/index.js and route USDA calls through it.
 */

const USDA_SEARCH_ENDPOINT = "https://api.nal.usda.gov/fdc/v1/foods/search";
const OFF_PRODUCT_ENDPOINT = "https://world.openfoodfacts.net/api/v2/product";

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES = 2;
const DEFAULT_PAGE_SIZE = 20;

// Open Food Facts types
type OFFNutriments = {
  "energy-kcal_100g"?: number;
  energy_100g?: number;
  fat_100g?: number;
  carbohydrates_100g?: number;
  proteins_100g?: number;
  fiber_100g?: number;
  [key: string]: number | string | undefined;
};

type OFFProduct = {
  code?: string;
  product_name?: string;
  product_name_ro?: string;
  product_name_en?: string;
  brands?: string;
  image_front_url?: string;
  image_front_small_url?: string;
  image_url?: string;
  nutriments?: OFFNutriments;
  serving_size?: string;
  product_quantity?: number;
  product_quantity_unit?: string;
  quantity?: string;
};

type OFFResponse = {
  code?: string;
  product?: OFFProduct | null;
  status?: number; // 1 = found, 0 = not found
  status_verbose?: string;
};

// USDA types
type UsdaSearchResponse = {
  foods?: UsdaFoodItem[];
};

type UsdaFoodNutrient = {
  nutrientNumber?: string;
  nutrientName?: string;
  value?: number;
};

type UsdaFoodItem = {
  fdcId: number;
  description?: string;
  brandOwner?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: UsdaFoodNutrient[];
};

export type NutritionBarcodeFood = {
  code: string;
  product_name: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  servingSize: string;
  brands?: string;
  image?: string;
};

export type NutritionSearchOptions = {
  page?: number;
  pageSize?: number;
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
};

const USDA_API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

const normalizeBarcode = (barcode: string): string =>
  barcode.trim().replace(/[^\d]/g, "");

const getBarcodeVariants = (barcode: string): string[] => {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return [];

  const variants = new Set<string>([normalized]);

  if (normalized.length === 12) {
    variants.add(`0${normalized}`);
  }

  if (normalized.length === 13 && normalized.startsWith("0")) {
    variants.add(normalized.slice(1));
  }

  return [...variants];
};

const buildSearchUrl = (query: string, options: NutritionSearchOptions): string => {
  const params = new URLSearchParams({
    query,
    pageSize: String(options.pageSize ?? DEFAULT_PAGE_SIZE),
    pageNumber: String(options.page ?? 1),
    api_key: USDA_API_KEY || "",
  });

  return `${USDA_SEARCH_ENDPOINT}?${params.toString()}`;
};

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: NutritionSearchOptions,
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
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (error) {
      const abortedByCaller = Boolean(config.signal?.aborted);
      if (isAbortError(error) && abortedByCaller) {
        throw error;
      }

      if (attempt === retries) {
        throw error;
      }

      const waitMs = Math.min(1000 * Math.pow(2, attempt), 5000);
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

const getNutrientValue = (
  food: UsdaFoodItem,
  nutrientNumber: string,
  fallbackNameIncludes?: string[],
): number => {
  const nutrients = food.foodNutrients || [];
  const byCode = nutrients.find((nutrient) => nutrient.nutrientNumber === nutrientNumber);
  if (typeof byCode?.value === "number" && Number.isFinite(byCode.value)) {
    return byCode.value;
  }

  if (fallbackNameIncludes?.length) {
    const byName = nutrients.find((nutrient) => {
      const nutrientName = nutrient.nutrientName?.toLowerCase() || "";
      return fallbackNameIncludes.some((term) => nutrientName.includes(term));
    });
    if (typeof byName?.value === "number" && Number.isFinite(byName.value)) {
      return byName.value;
    }
  }

  return 0;
};

const getServingNormalization = (
  food: UsdaFoodItem,
): {
  factor: number;
  servingSizeLabel: string;
} => {
  const servingSize = Number(food.servingSize) || 0;
  const servingUnitRaw = (food.servingSizeUnit || "").trim().toLowerCase();
  const isGram = ["g", "gram", "grams"].includes(servingUnitRaw);
  const isMl = ["ml", "milliliter", "milliliters"].includes(servingUnitRaw);

  if (servingSize > 0 && (isGram || isMl)) {
    return {
      factor: 100 / servingSize,
      servingSizeLabel: isMl ? "100ml" : "100g",
    };
  }

  if (servingSize > 0 && servingUnitRaw) {
    return {
      factor: 1,
      servingSizeLabel: `${servingSize}${servingUnitRaw}`,
    };
  }

  return {
    factor: 1,
    servingSizeLabel: "100g",
  };
};

const mapUsdaToFood = (food: UsdaFoodItem): NutritionBarcodeFood => {
  const { factor, servingSizeLabel } = getServingNormalization(food);
  const caloriesRaw = getNutrientValue(food, "1008", ["energy"]);
  const proteinRaw = getNutrientValue(food, "1003", ["protein"]);
  const carbsRaw = getNutrientValue(food, "1005", ["carbohydrate"]);
  const fatRaw = getNutrientValue(food, "1004", ["fat", "lipid"]);
  const fiberRaw = getNutrientValue(food, "1079", ["fiber", "fibre"]);

  const calories = Math.max(0, caloriesRaw * factor);
  const protein = Math.max(0, proteinRaw * factor);
  const carbs = Math.max(0, carbsRaw * factor);
  const fat = Math.max(0, fatRaw * factor);
  const fiber = Math.max(0, fiberRaw * factor);

  const name = (food.description || "Unknown Product").trim();
  const code = food.gtinUpc || String(food.fdcId);

  return {
    code,
    product_name: name,
    name,
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
    servingSize: servingSizeLabel,
    brands: food.brandOwner?.trim() || undefined,
  };
};

const fetchUsdaFoods = async (
  query: string,
  options: NutritionSearchOptions = {},
): Promise<UsdaFoodItem[]> => {
  if (!USDA_API_KEY) {
    if (__DEV__) {
      console.warn(
        "[FoodProvider] Missing EXPO_PUBLIC_USDA_API_KEY. USDA lookups are disabled.",
      );
    }
    return [];
  }

  const url = buildSearchUrl(query, options);
  const response = await fetchWithRetry(
    url,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
    options,
  );

  if (!response.ok) {
    if (__DEV__) {
      console.warn(
        `[FoodProvider] USDA request failed: ${response.status} ${response.statusText}`,
      );
    }
    return [];
  }

  const payload = (await response.json()) as UsdaSearchResponse;
  return payload.foods || [];
};

const dedupeFoods = (foods: NutritionBarcodeFood[]): NutritionBarcodeFood[] => {
  const seen = new Set<string>();
  const deduped: NutritionBarcodeFood[] = [];

  for (const food of foods) {
    const key = food.code || food.name.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(food);
  }

  return deduped;
};

// Open Food Facts text search
const OFF_SEARCH_ENDPOINT = "https://world.openfoodfacts.net/cgi/search.pl";

type OFFSearchResponse = {
  count?: number;
  page?: number;
  page_size?: number;
  products?: OFFProduct[];
};

const fetchOFFTextSearch = async (
  query: string,
  options: NutritionSearchOptions = {},
): Promise<NutritionBarcodeFood[]> => {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = options.page ?? 1;

  const params = new URLSearchParams({
    search_terms: query,
    json: "1",
    page_size: String(pageSize),
    page: String(page),
    fields: "code,product_name,product_name_ro,product_name_en,brands,nutriments,image_front_url,image_front_small_url,image_url",
  });

  const url = `${OFF_SEARCH_ENDPOINT}?${params.toString()}`;

  try {
    const response = await fetchWithRetry(
      url,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "TrainEatTrack/1.0 (https://github.com/Andrei6700/Train-Eat-Track)",
        },
      },
      {
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        retries: options.retries ?? 1,
        signal: options.signal,
      },
    );

    if (!response.ok) {
      if (__DEV__) {
        console.warn(
          `[FoodProvider] OFF search failed: ${response.status} ${response.statusText}`,
        );
      }
      return [];
    }

    const data = (await response.json()) as OFFSearchResponse;
    const products = data.products || [];

    const mapped = products
      .map((p) => mapOFFToFood(p, p.code || ""))
      .filter((f): f is NutritionBarcodeFood => f !== null);

    if (__DEV__) {
      console.log(`[FoodProvider] OFF text search found ${mapped.length} products for "${query}"`);
    }

    return mapped;
  } catch (error) {
    if (isAbortError(error) && options.signal?.aborted) {
      throw error;
    }

    if (__DEV__) {
      console.error("[FoodProvider] OFF text search failed:", error);
    }
    return [];
  }
};

export const searchFoods = async (
  query: string,
  options: NutritionSearchOptions = {},
): Promise<NutritionBarcodeFood[]> => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery || normalizedQuery.length < 2) {
    return [];
  }

  const searchOptions = {
    ...options,
    pageSize: options.pageSize ?? DEFAULT_PAGE_SIZE,
  };

  // Search both APIs in parallel
  const [usdaResult, offResult] = await Promise.allSettled([
    fetchUsdaFoods(normalizedQuery, searchOptions).then((foods) =>
      foods.map(mapUsdaToFood).filter((food) => food.calories > 0),
    ),
    fetchOFFTextSearch(normalizedQuery, searchOptions),
  ]);

  const usdaFoods =
    usdaResult.status === "fulfilled" ? usdaResult.value : [];
  const offFoods =
    offResult.status === "fulfilled" ? offResult.value : [];

  if (__DEV__) {
    if (usdaResult.status === "rejected" && !isAbortError(usdaResult.reason)) {
      console.error("[FoodProvider] USDA text search failed:", usdaResult.reason);
    }
    if (offResult.status === "rejected" && !isAbortError(offResult.reason)) {
      console.error("[FoodProvider] OFF text search failed:", offResult.reason);
    }
  }

  // Merge: USDA first (generic ingredients), then OFF (branded products)
  const merged = [...usdaFoods, ...offFoods];
  return dedupeFoods(merged);
};


// Open Food Facts barcode lookup

const mapOFFToFood = (product: OFFProduct, barcode: string): NutritionBarcodeFood | null => {
  const name =
    product.product_name?.trim() ||
    product.product_name_ro?.trim() ||
    product.product_name_en?.trim() ||
    "";

  if (!name) return null;

  const n = product.nutriments || {};

  // OFF stores energy as energy-kcal_100g (kcal) or energy_100g (kJ)
  // kcal directly, otherwise convert kJ -> kcal
  let calories = Number(n["energy-kcal_100g"]) || 0;
  if (!calories && n.energy_100g) {
    calories = Math.round(Number(n.energy_100g) / 4.184);
  }

  const protein = Math.max(0, Math.round((Number(n.proteins_100g) || 0) * 10) / 10);
  const carbs = Math.max(0, Math.round((Number(n.carbohydrates_100g) || 0) * 10) / 10);
  const fat = Math.max(0, Math.round((Number(n.fat_100g) || 0) * 10) / 10);
  const fiber = Math.max(0, Math.round((Number(n.fiber_100g) || 0) * 10) / 10);

  const image =
    product.image_front_url ||
    product.image_front_small_url ||
    product.image_url ||
    undefined;

  return {
    code: product.code || barcode,
    product_name: name,
    name,
    calories: Math.max(0, Math.round(calories)),
    protein,
    carbs,
    fat,
    fiber: fiber || undefined,
    servingSize: "100g",
    brands: product.brands?.trim() || undefined,
    image,
  };
};

const fetchOFFProduct = async (
  barcode: string,
  options: NutritionSearchOptions = {},
): Promise<NutritionBarcodeFood | null> => {
  const url = `${OFF_PRODUCT_ENDPOINT}/${encodeURIComponent(barcode)}`;

  try {
    const response = await fetchWithRetry(
      url,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "TrainEatTrack/1.0 (https://github.com/Andrei6700/Train-Eat-Track)",
        },
      },
      {
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        retries: options.retries ?? 1,
        signal: options.signal,
      },
    );

    if (!response.ok) {
      if (__DEV__) {
        console.warn(
          `[FoodProvider] OFF request failed: ${response.status} ${response.statusText}`,
        );
      }
      return null;
    }

    const data = (await response.json()) as OFFResponse;

    // OFF returns status 0 when product is not found
    if (!data.product || data.status === 0) {
      if (__DEV__) {
        console.log(`[FoodProvider] OFF: product not found for barcode ${barcode}`);
      }
      return null;
    }

    const mapped = mapOFFToFood(data.product, barcode);

    if (mapped && __DEV__) {
      console.log(`[FoodProvider] OFF: found "${mapped.name}" for barcode ${barcode}`);
    }

    return mapped;
  } catch (error) {
    if (isAbortError(error) && options.signal?.aborted) {
      throw error;
    }

    if (__DEV__) {
      console.error("[FoodProvider] OFF barcode lookup failed:", error);
    }
    return null;
  }
};

// Combined barcode search

export const searchByBarcode = async (
  barcode: string,
  options: NutritionSearchOptions = {},
): Promise<NutritionBarcodeFood | null> => {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return null;

  // 1. Try Open Food Facts first (global database, for EAN/international barcodes)
  const offResult = await fetchOFFProduct(normalized, options);
  if (offResult) {
    return offResult;
  }

  // 2. Fall back to USDA (US-centric)
  const variants = getBarcodeVariants(normalized);
  if (variants.length === 0) {
    return null;
  }

  const queryVariants = [
    ...variants.map((value) => `UPC:${value}`),
    ...variants,
  ];

  for (const queryValue of queryVariants) {
    try {
      const foods = await fetchUsdaFoods(queryValue, {
        ...options,
        pageSize: 25,
      });

      if (foods.length === 0) continue;

      const exact = foods.find((item) => {
        const itemCode = normalizeBarcode(item.gtinUpc || "");
        return variants.includes(itemCode);
      });

      const target = exact || foods[0];
      return mapUsdaToFood(target);
    } catch (error) {
      if (isAbortError(error) && options.signal?.aborted) {
        throw error;
      }

      if (__DEV__) {
        console.error("[FoodProvider] USDA barcode lookup failed:", error);
      }
    }
  }

  return null;
};
