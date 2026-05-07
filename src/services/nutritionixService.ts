const USDA_SEARCH_ENDPOINT = "https://api.nal.usda.gov/fdc/v1/foods/search";

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES = 2;
const DEFAULT_PAGE_SIZE = 20;

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
        "[NutritionixService] Missing EXPO_PUBLIC_USDA_API_KEY. USDA lookups are disabled.",
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
        `[NutritionixService] USDA request failed: ${response.status} ${response.statusText}`,
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

export const searchFoods = async (
  query: string,
  options: NutritionSearchOptions = {},
): Promise<NutritionBarcodeFood[]> => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery || normalizedQuery.length < 2) {
    return [];
  }

  try {
    const foods = await fetchUsdaFoods(normalizedQuery, {
      ...options,
      pageSize: options.pageSize ?? DEFAULT_PAGE_SIZE,
    });

    const mapped = foods.map(mapUsdaToFood).filter((food) => food.calories > 0);
    return dedupeFoods(mapped);
  } catch (error) {
    if (isAbortError(error) && options.signal?.aborted) {
      throw error;
    }

    if (__DEV__) {
      console.error("[NutritionixService] USDA text search failed:", error);
    }
    return [];
  }
};

export const searchByBarcode = async (
  barcode: string,
  options: NutritionSearchOptions = {},
): Promise<NutritionBarcodeFood | null> => {
  const variants = getBarcodeVariants(barcode);
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
        console.error("[NutritionixService] USDA barcode lookup failed:", error);
      }
    }
  }

  return null;
};
