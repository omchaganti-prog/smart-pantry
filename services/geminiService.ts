import { PantryItem, FoodCategory, ScanResult, Recipe, RecipePreferences, WeeklyPlan, UserProfile } from "../types";

/**
 * Analyzes an image to detect food items and read expiration dates (OCR).
 */
export const analyzeImage = async (base64Image: string): Promise<ScanResult> => {
  try {
    const response = await fetch('/api/gemini/analyze-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to analyze image");
    }

    const result = await response.json();
    return {
      name: result.name || "Unknown Item",
      category: result.category as FoodCategory || FoodCategory.OTHER,
      expiryDate: result.expiryDate || null,
      confidence: result.confidence || 0.5
    };
  } catch (error) {
    console.error("Image Analysis Error:", error);
    throw new Error("Failed to analyze image.");
  }
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
  userProfile?: UserProfile
): Promise<Recipe[]> => {
  try {
    const response = await fetch('/api/gemini/suggest-recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, preferences, userProfile })
    });

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
