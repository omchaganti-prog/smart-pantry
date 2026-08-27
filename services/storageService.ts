
import { PantryItem, ShoppingItem, WeeklyPlan, UserProfile, SkillLevel, ThemePreference } from '../types';

const STORAGE_KEY = 'smart_pantry_items';
const SHOPPING_KEY = 'smart_pantry_shopping_list';
const MEAL_PLAN_KEY = 'smart_pantry_meal_plan';
const PROFILE_KEY = 'smart_pantry_user_profile';

// --- Pantry Items ---

export const getItems = (): PantryItem[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load items", e);
    return [];
  }
};

export const saveItem = (item: PantryItem): void => {
  const items = getItems();
  const updatedItems = [item, ...items];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
};

export const updateItem = (updatedItem: PantryItem): void => {
  const items = getItems();
  const index = items.findIndex(i => i.id === updatedItem.id);
  if (index !== -1) {
    items[index] = updatedItem;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
};

export const deleteItem = (id: string): void => {
  const items = getItems();
  const filtered = items.filter(i => i.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};

export const clearItems = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

// --- Shopping List ---

export const getShoppingList = (): ShoppingItem[] => {
  try {
    const data = localStorage.getItem(SHOPPING_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const addToShoppingList = (name: string, amount: string): void => {
  const list = getShoppingList();
  // Check if similar item exists to merge (simple logic)
  const existing = list.find(i => i.name.toLowerCase() === name.toLowerCase() && !i.checked);
  
  if (existing) {
    // Ideally we would parse amounts and add them, but for string amounts we just append
    existing.amount = `${existing.amount} + ${amount}`;
    localStorage.setItem(SHOPPING_KEY, JSON.stringify(list));
  } else {
    const newItem: ShoppingItem = {
      id: crypto.randomUUID(),
      name,
      amount,
      checked: false
    };
    localStorage.setItem(SHOPPING_KEY, JSON.stringify([newItem, ...list]));
  }
};

export const toggleShoppingItem = (id: string): void => {
  const list = getShoppingList();
  const item = list.find(i => i.id === id);
  if (item) {
    item.checked = !item.checked;
    localStorage.setItem(SHOPPING_KEY, JSON.stringify(list));
  }
};

export const removeShoppingItem = (id: string): void => {
  const list = getShoppingList();
  const filtered = list.filter(i => i.id !== id);
  localStorage.setItem(SHOPPING_KEY, JSON.stringify(filtered));
};

// New method for bulk updates (Select All / Delete All)
export const updateShoppingList = (items: ShoppingItem[]): void => {
  localStorage.setItem(SHOPPING_KEY, JSON.stringify(items));
};

export const clearShoppingList = (): void => {
  localStorage.removeItem(SHOPPING_KEY);
};

// --- Meal Plan ---

export const getMealPlan = (): WeeklyPlan | null => {
  try {
    const data = localStorage.getItem(MEAL_PLAN_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
};

export const saveMealPlan = (plan: WeeklyPlan): void => {
  localStorage.setItem(MEAL_PLAN_KEY, JSON.stringify(plan));
};

// --- User Profile ---

const DEFAULT_PROFILE: UserProfile = {
  id: 'user-default',
  name: 'Home Chef',
  nickname: '',
  avatar: '👨‍🍳',
  dietaryPreferences: [],
  allergies: [],
  settings: {
    theme: 'light',
    themePreference: ThemePreference.BASIL,
    measurements: 'metric',
    spicinessLevel: 1,
    household: {
      adults: 1,
      children: 0
    },
    skillLevel: SkillLevel.BEGINNER,
    notifications: {
      enabled: true,
      expiryAlerts: true,
      mealReminders: true,
      missingItems: true,
      weeklyReport: false
    },
    security: {
      biometricEnabled: false,
      pinLock: false
    },
    aiPersona: {
      mealStyle: 'Healthy',
      photoStyle: 'Realistic'
    }
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

/**
 * Wipes the user's saved data. "Reset everything" used to clear only the pantry and
 * shopping list despite promising to remove plans too, leaving stale meal plans,
 * favourites and history behind.
 *
 * Deliberately keeps the profile (allergies, skill, theme) — silently dropping someone's
 * allergy list would be the dangerous kind of surprise.
 */
export const clearAllData = (): void => {
  [
    STORAGE_KEY,
    SHOPPING_KEY,
    MEAL_PLAN_KEY,
    'smart_pantry_favorites',
    'smart_pantry_saved_for_later',
    'smart_pantry_recipes_cache',
    'smartpantry_recently_viewed',
    'smart_pantry_preferences',
  ].forEach(key => localStorage.removeItem(key));

  ['smart_pantry_recipe_state', 'smart_pantry_quick_search'].forEach(key =>
    sessionStorage.removeItem(key)
  );
};

export const getUserProfile = (): UserProfile => {
  try {
    const data = localStorage.getItem(PROFILE_KEY);
    if (!data) return DEFAULT_PROFILE;
    
    const profile = JSON.parse(data);
    // Deep merge with default settings to ensure new fields exist for old users
    if (!profile.settings) {
      profile.settings = DEFAULT_PROFILE.settings;
    } else {
       // Check nested properties
       if (!profile.settings.household) profile.settings.household = DEFAULT_PROFILE.settings.household;
       if (!profile.settings.notifications) profile.settings.notifications = DEFAULT_PROFILE.settings.notifications;
       if (!profile.settings.security) profile.settings.security = DEFAULT_PROFILE.settings.security;
       if (!profile.settings.aiPersona) profile.settings.aiPersona = DEFAULT_PROFILE.settings.aiPersona;
       if (!profile.settings.themePreference) profile.settings.themePreference = DEFAULT_PROFILE.settings.themePreference;
       if (!profile.settings.skillLevel) profile.settings.skillLevel = DEFAULT_PROFILE.settings.skillLevel;
    }
    return profile;
  } catch (e) {
    return DEFAULT_PROFILE;
  }
};

export const saveUserProfile = (profile: UserProfile): void => {
  const updatedProfile = { ...profile, updatedAt: new Date().toISOString() };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));
};
