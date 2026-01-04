import { getDailyNutrition } from "./nutritionService";

type CachedNutrition = {
  calories: number;
  goal: number;
  date: Date;
};

const cache = new Map<string, CachedNutrition>();

const getCacheKey = (date: Date): string => {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

export const preloadWeekNutrition = async (
  userID: string,
  weekDates: Date[]
): Promise<Map<string, CachedNutrition>> => {
  const promises = weekDates.map(async (date) => {
    const key = getCacheKey(date);
    
    if (cache.has(key)) {
      return { key, data: cache.get(key)! };
    }

    const result = await getDailyNutrition(userID, date);
    
    let calories = 0;
    let goal = 2500;

    if (result.success && result.data) {
      goal = result.data.calorieGoal || 2500;
      calories = result.data.meals.reduce((total, meal) => {
        return total + meal.foods.reduce((sum, food) => sum + (food.calories || 0), 0);
      }, 0);
    }

    const cached: CachedNutrition = { calories, goal, date };
    cache.set(key, cached);

    return { key, data: cached };
  });

  const results = await Promise.all(promises);
  
  return new Map(results.map(r => [r.key, r.data]));
};

export const getCachedNutrition = (date: Date): CachedNutrition | null => {
  const key = getCacheKey(date);
  return cache.get(key) || null;
};

export const clearCache = () => {
  cache.clear();
};

export const invalidateDayCache = (date: Date) => {
  const key = getCacheKey(date);
  cache.delete(key);
};