import { supabase } from "@/src/config/supabase";
import { SimplifiedFood } from "./foodApiService";

export type CustomProduct = {
  id: string;
  barcode: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: string;
  brands?: string;
  image_url?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

/**
 * Search custom products by barcode in Supabase
 */
export const getCustomProductByBarcode = async (
  barcode: string
): Promise<CustomProduct | null> => {
  try {
    const { data, error } = await supabase
      .from("custom_products")
      .select("*")
      .eq("barcode", barcode)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found - this is expected
        return null;
      }
      if (__DEV__) {
        console.error("[CustomProductService] Error fetching:", error);
      }
      return null;
    }

    return data as CustomProduct;
  } catch (error: any) {
    if (__DEV__) {
      console.error("[CustomProductService] Unexpected error:", error?.message);
    }
    return null;
  }
};

/**
 * Save custom product to Supabase
 */
export const saveCustomProduct = async (
  barcode: string,
  productData: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    serving_size: string;
    brands?: string;
    image_url?: string;
  },
  user_id: string
): Promise<CustomProduct | null> => {
  try {
    const { data, error } = await supabase
      .from("custom_products")
      .insert([
        {
          barcode,
          ...productData,
          user_id,
        },
      ])
      .select()
      .single();

    if (error) {
      if (__DEV__) {
        console.error("[CustomProductService] Error saving:", error);
      }
      return null;
    }

    if (__DEV__) {
      console.log("[CustomProductService] Product saved:", data);
    }

    return data as CustomProduct;
  } catch (error: any) {
    if (__DEV__) {
      console.error("[CustomProductService] Unexpected error:", error?.message);
    }
    return null;
  }
};

/**
 * Search custom products by name
 */
export const searchCustomProducts = async (
  query: string
): Promise<CustomProduct[]> => {
  if (!query || query.trim().length < 2) return [];

  try {
    const { data, error } = await supabase
      .from("custom_products")
      .select("*")
      .ilike("name", `%${query}%`)
      .limit(10);

    if (error) {
      if (__DEV__) {
        console.error("[CustomProductService] Search error:", error);
      }
      return [];
    }

    return (data || []) as CustomProduct[];
  } catch (error: any) {
    if (__DEV__) {
      console.error("[CustomProductService] Search unexpected error:", error?.message);
    }
    return [];
  }
};

/**
 * Convert CustomProduct to SimplifiedFood for UI
 */
export const toSimplifiedFromCustom = (product: CustomProduct): SimplifiedFood => ({
  code: `custom-${product.id}`,
  product_name: product.name,
  name: product.name,
  calories: product.calories,
  protein: product.protein,
  carbs: product.carbs,
  fat: product.fat,
  servingSize: product.serving_size,
  brands: product.brands,
  image: product.image_url,
});
