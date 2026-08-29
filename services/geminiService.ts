import { PantryItem, FoodCategory, ScanResult, Recipe, RecipePreferences, WeeklyPlan, UserProfile } from "../types";

/**
 * Every failure used to read "Failed to analyze image." — including a 413, which is what
 * a real phone photo produced. Say what actually went wrong so it's fixable.
 */
const describeScanFailure = async (response: Response): Promise<string> => {
  // a 413 or a proxy error returns HTML, so parsing it as JSON throws in its own right
  let serverMessage = '';
  try {
    serverMessage = (await response.json())?.message ?? '';
  } catch {
    /* not JSON — fall back to the status */
  }

  if (response.status === 413) return 'That photo was too large to upload. Try again — it should be resized automatically.';
  if (response.status === 429) return 'Too many scans just now. Wait a few seconds and try again.';
  if (response.status === 503) return 'Image scanning is not configured on the server.';
  if (response.status >= 500) return serverMessage || 'The AI service is having trouble. Try again in a moment.';
  return serverMessage || `Scan failed (${response.status}).`;
};

/**
 * Detects every food item in an image, reading expiry dates where they're legible.
 * Returns one entry per item — a photo of a fridge shelf yields the whole shelf.
 */
export const analyzeImage = async (base64Image: string): Promise<ScanResult[]> => {
  const response = await fetch('/api/gemini/analyze-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image })
  });

  if (!response.ok) {
    throw new Error(await describeScanFailure(response));
  }

  const data = await response.json();
  const items: any[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];

  return items.map((item: any) => ({
    name: item.name || 'Unknown Item',
    category: (item.category as FoodCategory) || FoodCategory.OTHER,
    expiryDate: item.expiryDate || null,
    confidence: typeof item.confidence === 'number' ? item.confidence : 0.5,
    quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
    unit: typeof item.unit === 'string' && item.unit.trim() ? item.unit.trim() : 'pcs',
  }));
};

/**
 * Generates a recipe for a specific dish name requested by the user.
 */
export const generateRecipeFromDish = async (
  dishName: string,
  items: PantryItem[],
  servings: number = 4,
  userProfile?: UserProfile
): Promise<Recipe | null> => {
  try {
    const response = await fetch('/api/gemini/generate-recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dishName, items, servings, userProfile })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Dish Generation Error:", error.message);
      return null;
    }

    return await response.json();
  } catch (error: any) {
    console.error("Dish Generation Error:", error);
    return null;
  }
};

/**
 * Generates recipes based on available pantry items, prioritizing expiring ones.
 */
export const suggestRecipes = async (
  items: PantryItem[],
  preferences: RecipePreferences,
  userProfile?: UserProfile,
  excludeTitles?: string[]
): Promise<Recipe[]> => {
  try {
    console.log('[geminiService] suggestRecipes -> POST /api/gemini/suggest-recipes', { itemsLength: items?.length });
    const response = await fetch('/api/gemini/suggest-recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, preferences, userProfile, excludeTitles })
    });
    console.log('[geminiService] suggestRecipes response.ok', response.ok, 'status', response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error("Recipe Generation Error:", error.message);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error("Recipe Generation Error:", error);
    return [];
  }
};

/**
 * Generates a 7-day meal plan based on pantry items.
 */
export const generateMealPlan = async (items: PantryItem[], userProfile?: UserProfile): Promise<WeeklyPlan | null> => {
  try {
    const response = await fetch('/api/gemini/generate-meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, userProfile })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Meal Plan Error:", error.message);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Meal Plan Error:", error);
    return null;
  }
};
