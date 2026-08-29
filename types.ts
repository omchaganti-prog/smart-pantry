
export enum FoodCategory {
  PRODUCE = 'Produce',
  DAIRY = 'Dairy',
  MEAT = 'Meat',
  PANTRY = 'Pantry',
  SNACKS = 'Snacks',
  BEVERAGES = 'Beverages',
  FROZEN = 'Frozen',
  OTHER = 'Other'
}

export interface PantryItem {
  id: string;
  name: string;
  category: FoodCategory;
  expiryDate: string | null; // ISO Date string YYYY-MM-DD
  quantity: number;
  unit: string;
  addedDate: string;
  thumbnail?: string; // Base64 thumbnail for UI
}

export interface ShoppingItem {
  id: string;
  name: string;
  amount: string;
  checked: boolean;
}

export interface ScanResult {
  name: string;
  category: FoodCategory;
  expiryDate: string | null;
  confidence: number;
  quantity?: number;
  unit?: string;
}

// Ingredient item used inside ingredient sections. Keep a few optional fields
// for backward compatibility with existing code, but primary shape is simple.
export interface IngredientItem {
  name: string;
  quantity: string;
  unit?: string;

  // Optional legacy fields (kept for compatibility; not required by new AI)
  status?: 'Have' | 'Missing' | 'Partial';
  amountToBuy?: string;
  substitute?: string;
  isAllergen?: boolean;
  isOptional?: boolean;
  prepNote?: string;
  cautionNote?: string;
}

export interface RecipeNutrition {
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
}

export interface ServingScaleMultiplier {
  multiplier: string; // "1x", "2x", "3x"
  servings: number;
  yield: string; // e.g., "Makes 8-10 pancakes"
}

export interface IngredientSection {
  title: string;
  items: IngredientItem[];
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  imageKeyword?: string; // Visual search term for the dish
  videoUrl?: string; // Optional cooking video URL
  matchScore: number; // 0-100
  healthScore: number; // 0-10
  costTier: 'Low' | 'Medium' | 'High';
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;

  // New structured ingredient model: recipe-defined sections.
  ingredientSections?: IngredientSection[];

  // Legacy flat ingredients array (optional). New code should normalize
  // this into `ingredientSections` when present.
  ingredients?: IngredientItem[];

  instructions: string[];
  nutrition: RecipeNutrition;
  tags: string[];
  allergenWarning?: string | null; // "Contains Peanuts"
  safe?: boolean; // false if contains allergens
  spiciness?: number; // 1-5 scale
  spiceLevel?: 'mild' | 'medium' | 'spicy' | 'fiery';
  yieldNote?: string; // e.g., "Makes about 8-10 pancakes"
  servingScaleMultipliers?: ServingScaleMultiplier[]; // 1x, 2x, 3x scaling info
}

export interface RecipePreferences {
  diet: 'None' | 'Vegetarian' | 'Vegan' | 'Keto' | 'Gluten-Free' | 'Paleo';
  cuisine: 'Any' | 'Italian' | 'Mexican' | 'Asian' | 'American' | 'Mediterranean' | 'Indian';
  mode: 'Standard' | 'Quick' | 'Healthy' | 'PantryHero' | 'Budget' | 'LeftoverFusion';
}

// --- User Profile & Settings Types ---

export enum SkillLevel {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  EXPERT = 'Expert',
  PROFESSIONAL = 'Professional'
}

export enum ThemePreference {
  BASIL = 'Basil',
  LEMON = 'Lemon',
  TOMATO = 'Tomato',
  BLUEBERRY = 'Blueberry',
  LATTE = 'Latte'
}

export interface AppSettings {
  // Appearance
  theme: 'light' | 'dark';
  themePreference: ThemePreference; // Brand color
  
  // Cooking
  measurements: 'metric' | 'imperial';
  spicinessLevel: number; // 0-3
  
  // Household
  household: {
    adults: number;
    children: number;
  };
  skillLevel: SkillLevel;

  // Notification Flags
  notifications: {
    enabled: boolean;
    expiryAlerts: boolean;
    mealReminders: boolean;
    missingItems: boolean;
    weeklyReport: boolean;
  };

  // Security
  security: {
    biometricEnabled: boolean;
    pinLock: boolean;
  };

  // AI Persona
  aiPersona: {
    mealStyle: 'Quick' | 'Gourmet' | 'Healthy' | 'Budget';
    photoStyle: 'Realistic' | 'Artistic';
  };
}

export interface UserProfile {
  id: string;
  name: string;
  nickname: string;
  avatar: string; // Emoji character or URL
  dietaryPreferences: string[];
  allergies: string[];
  settings: AppSettings;
  createdAt: string;
  updatedAt: string;
}

// --- Meal Planning Types ---

export interface Meal {
  type: 'Breakfast' | 'Lunch' | 'Dinner';
  title: string;
  description: string;
  missingIngredients: string[]; // List of items needed to buy
}

export interface DayPlan {
  day: string; // "Monday", "Tuesday", etc.
  meals: Meal[];
}

export interface WeeklyPlan {
  id: string;
  weekOf: string;
  days: DayPlan[];
}
