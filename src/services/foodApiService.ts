import { ResponseType } from '@/src/types/index';

const OPEN_FOOD_FACTS_API = "https://world.openfoodfacts.org/cgi/search.pl";
const PRODUCT_API = "https://world.openfoodfacts.org/api/v2/product";

export type OpenFoodFactsProduct = {
  code: string;
  product_name: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    'energy-kcal_serving'?: number;
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

/**
 * Caută alimente în baza de date Open Food Facts
 */
export const searchFood = async (
  query: string,
  page: number = 1,
  pageSize: number = 20
): Promise<SimplifiedFood[]> => {
  try {
    if (!query || query.trim().length < 2) {
      console.log('[FoodAPI] Query too short');
      return [];
    }

    const params = new URLSearchParams({
      search_terms: query.trim(),
      page: page.toString(),
      page_size: pageSize.toString(),
      json: '1',
      fields: 'code,product_name,brands,quantity,serving_size,nutriments,image_url',
      tagtype_0: 'states',
      tag_contains_0: 'contains',
      tag_0: 'en:nutrition-facts-completed'
    });

    const url = `${OPEN_FOOD_FACTS_API}?${params.toString()}`;
    console.log('[FoodAPI] Searching:', url);

    // ✅ Timeout pentru request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secunde timeout

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'FitnessApp/1.0 (fitness.app@example.com)',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[FoodAPI] Error response:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    
    if (!data.products || data.products.length === 0) {
      console.log('[FoodAPI] No products found');
      return [];
    }

    console.log(`[FoodAPI] Found ${data.products.length} products`);

    // Transformă rezultatele în formatul nostru
    const simplifiedFoods: SimplifiedFood[] = data.products
      .filter((product: OpenFoodFactsProduct) => {
        return product.nutriments && 
               (product.nutriments['energy-kcal_100g'] || product.nutriments['energy-kcal_serving']);
      })
      .map((product: OpenFoodFactsProduct) => {
        const nutriments = product.nutriments || {};
        
        const calories = nutriments['energy-kcal_serving'] || nutriments['energy-kcal_100g'] || 0;
        const protein = nutriments.proteins_serving || nutriments.proteins_100g || 0;
        const carbs = nutriments.carbohydrates_serving || nutriments.carbohydrates_100g || 0;
        const fat = nutriments.fat_serving || nutriments.fat_100g || 0;
        
        let servingSize = '100g';
        if (product.serving_size) {
          servingSize = product.serving_size;
        } else if (product.quantity) {
          servingSize = product.quantity;
        }

        return {
          code: product.code,
          product_name: product.product_name || 'Unknown Product',
          name: product.product_name || 'Unknown Product',
          calories: Math.round(calories),
          protein: Math.round(protein * 10) / 10,
          carbs: Math.round(carbs * 10) / 10,
          fat: Math.round(fat * 10) / 10,
          servingSize,
          brands: product.brands,
          image: product.image_url,
        };
      });

    return simplifiedFoods;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[FoodAPI] Request timeout');
    } else {
      console.error('[FoodAPI] Search error:', error.message);
    }
    return [];
  }
};

/**
 * Obține detalii despre un produs specific după barcode
 */
export const getFoodByBarcode = async (
  barcode: string
): Promise<ResponseType> => {
  try {
    const url = `${PRODUCT_API}/${barcode}`;
    console.log('[FoodAPI] Fetching barcode:', url);

    // ✅ Timeout pentru request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'FitnessApp/1.0 (fitness.app@example.com)',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[FoodAPI] Error response:', response.status);
      return { success: false, msg: 'Product not found' };
    }

    const data = await response.json();
    
    if (data.status === 0 || !data.product) {
      return { success: false, msg: 'Product not found in database' };
    }

    const product: OpenFoodFactsProduct = data.product;
    const nutriments = product.nutriments || {};

    const simplifiedFood: SimplifiedFood = {
      code: product.code,
      product_name: product.product_name || 'Unknown Product',
      name: product.product_name || 'Unknown Product',
      calories: Math.round(nutriments['energy-kcal_100g'] || 0),
      protein: Math.round((nutriments.proteins_100g || 0) * 10) / 10,
      carbs: Math.round((nutriments.carbohydrates_100g || 0) * 10) / 10,
      fat: Math.round((nutriments.fat_100g || 0) * 10) / 10,
      servingSize: product.serving_size || product.quantity || '100g',
      brands: product.brands,
      image: product.image_url,
    };

    return { success: true, data: simplifiedFood };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[FoodAPI] Barcode request timeout');
      return { success: false, msg: 'Request timeout' };
    }
    console.error('[FoodAPI] Barcode search error:', error.message);
    return { success: false, msg: error?.message || 'Error fetching product' };
  }
};

/**
 * Sugestii de căutare bazate pe categorii populare
 */
export const getFoodSuggestions = (category: 'protein' | 'carbs' | 'snacks' | 'breakfast'): string[] => {
  const suggestions = {
    protein: ['chicken breast', 'salmon', 'eggs', 'greek yogurt', 'protein powder', 'tuna', 'beef'],
    carbs: ['rice', 'pasta', 'bread', 'oats', 'potato', 'quinoa', 'sweet potato'],
    snacks: ['almonds', 'peanut butter', 'protein bar', 'apple', 'banana', 'crackers'],
    breakfast: ['oatmeal', 'cereal', 'pancakes', 'eggs', 'yogurt', 'toast', 'milk'],
  };
  
  return suggestions[category] || [];
};