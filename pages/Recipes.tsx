
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getItems, addToShoppingList, getUserProfile } from '../services/storageService';
import { suggestRecipes, generateRecipeFromDish } from '../services/geminiService';
import { Recipe, RecipePreferences, PantryItem, IngredientItem, IngredientSection, UserProfile } from '../types';
import { ChefHat, Clock, AlertCircle, Loader2, Filter, Flame, CheckCircle2, XCircle, ChevronDown, ChevronUp, Leaf, DollarSign, Heart, ShoppingCart, Plus, Sparkles, Search, ArrowRight, Users, UtensilsCrossed, AlertTriangle, ImageOff, Award, Bookmark, Play, HelpCircle, Timer } from 'lucide-react';
import { useCookingSkill } from '../contexts/CookingSkillContext';
import { useSpiceTolerance } from '../contexts/SpiceToleranceContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useAllergy } from '../contexts/AllergyContext';
import { useWalkthrough } from '../contexts/WalkthroughContext';
import { useRecentlyViewed } from '../contexts/RecentlyViewedContext';
import { useUndo } from '../contexts/UndoContext';
import VideoPlayer from '../components/VideoPlayer';
import CookingTimer from '../components/CookingTimer';
import { useWaitMessage } from '../hooks/useWaitMessage';
import { takeQueuedRecipe } from '../services/openRecipeService';

const RECIPE_STATE_KEY = 'smart_pantry_recipe_state';
const PREFS_KEY = 'smart_pantry_preferences';

// Pollinations' anonymous tier allows exactly ONE in-flight request per IP — a burst of
// one-image-per-card returns 429 ("Queue full for IP") and the losers used to fall
// straight to "Image unavailable". So image loads run strictly one at a time.
const IMAGE_GAP_MS = 300;        // breather between images
const IMAGE_TIMEOUT_MS = 25000;  // generating a fresh image can take ~10-20s
const IMAGE_MAX_ATTEMPTS = 3;

type ImageTask = { run: () => void; cancelled: boolean };

const imageQueue: ImageTask[] = [];
let imageBusy = false;

const startNextImage = () => {
  if (imageBusy) return;
  let task = imageQueue.shift();
  while (task?.cancelled) task = imageQueue.shift();
  if (!task) return;
  imageBusy = true;
  task.run();
};

// Returns a cancel/release handle. A watchdog releases the slot regardless, so a card
// unmounted mid-request can never stall every image behind it.
const acquireImageSlot = (start: () => void): (() => void) => {
  let settled = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;

  const release = () => {
    if (settled) return;
    settled = true;
    task.cancelled = true;
    if (watchdog) clearTimeout(watchdog);
    if (started) {
      setTimeout(() => { imageBusy = false; startNextImage(); }, IMAGE_GAP_MS);
    }
  };

  let started = false;
  const task: ImageTask = {
    cancelled: false,
    run: () => {
      started = true;
      watchdog = setTimeout(release, IMAGE_TIMEOUT_MS);
      start();
    },
  };

  imageQueue.push(task);
  startNextImage();
  return release;
};

// LoremFlickr takes comma-separated tags and always answers with a real photo.
const toPhotoTags = (text: string): string => {
  const tags = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 4);
  return [...tags, 'food'].join(',');
};

// Escalating sources, best-looking first. Pollinations generates an image of the actual
// dish but its anonymous tier throttles hard (one in-flight request per IP), so a real
// stock photo backs it up rather than letting a card end up with no image at all.
// Settings → AI Chef → Photo Style
const PHOTO_STYLE_PROMPTS: Record<string, string> = {
  Realistic: 'professional food photography 4k natural lighting',
  Artistic: 'artistic food illustration, painterly, vibrant colours, stylised',
};

const buildRecipeImageUrl = (
  keyword: string | undefined,
  title: string,
  attempt: number,
  photoStyle: string = 'Realistic'
): string => {
  const subject = keyword || title;
  const style = PHOTO_STYLE_PROMPTS[photoStyle] ?? PHOTO_STYLE_PROMPTS.Realistic;
  switch (attempt) {
    case 0:
      return `https://image.pollinations.ai/prompt/${encodeURIComponent(`${subject} ${style}`)}?width=800&height=450&nologo=true`;
    case 1:
      // tags are already reduced to [a-z0-9] words; the commas must stay literal or
      // LoremFlickr reads the whole thing as a single tag
      return `https://loremflickr.com/800/450/${toPhotoTags(subject)}`;
    default:
      return `https://loremflickr.com/800/450/food,meal,dish`;
  }
};

const loadPersistedPrefs = (): RecipePreferences | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
};

// The AI returns recipe-defined `ingredientSections`; older cached recipes may still
// carry the legacy flat `ingredients` array. Normalize both into sections.
// Accept the key variants the model uses ("ingredient"/"amount", or a bare string) and
// drop anything still nameless — a nameless item renders as a blank row with a lone
// "Missing" under it. Recipes cached before this fix are cleaned up on the way in.
const UNIT_WORDS =
  'g|kg|mg|ml|l|oz|lb|lbs|cup|cups|tbsp|tbs|tsp|tablespoons?|teaspoons?|cloves?|pcs|pieces?|cans?|slices?|pinch|dash|sticks?|bunch|handful|packets?|bags?';
// a trailing word counts as a unit only if it is one, so "3 ripe bananas" keeps its name
const INGREDIENT_STRING = new RegExp(`^\\s*([\\d./½¼¾⅓⅔]+(?:\\s*(?:${UNIT_WORDS})\\b)?)?\\s*(.*)$`, 'i');

const readIngredient = (raw: any): IngredientItem | null => {
  if (typeof raw === 'string') {
    const match = raw.trim().match(INGREDIENT_STRING);
    const name = (match?.[2] ?? raw).trim();
    return name ? ({ name, quantity: (match?.[1] ?? '').trim() } as IngredientItem) : null;
  }
  const i = raw ?? {};
  // `title` is deliberately not a candidate — it belongs to sections, and treating it as
  // an ingredient name is what turned a nested "Cake Ingredients" group into a lone row.
  const name = [i.name, i.ingredient, i.item, i.label]
    .find((v: any) => typeof v === 'string' && v.trim())?.trim();
  if (!name) return null;
  const quantity = [i.quantity, i.amount, i.qty, i.measure]
    .find((v: any) => (typeof v === 'string' && v.trim()) || typeof v === 'number');
  return { ...i, name, quantity: quantity === undefined ? '' : String(quantity).trim() };
};

// The model sometimes nests a section inside a section — an "item" that is really
// { title: "Cake Ingredients", items: [...] }. Promote those to real sections instead
// of letting them collapse into a single nameless row.
const expandNestedSections = (sections: any[]): any[] =>
  sections.flatMap(section => {
    const items: any[] = Array.isArray(section?.items) ? section.items : [];
    const groups = items.filter(i => i && Array.isArray(i.items));
    if (groups.length === 0) return [section];

    const loose = items.filter(i => !(i && Array.isArray(i.items)));
    return [
      ...(loose.length > 0 ? [{ title: section.title, items: loose }] : []),
      ...groups.map(g => ({ title: g.title ?? g.name ?? section.title, items: g.items })),
    ];
  });

const getIngredientSections = (recipe: Recipe): IngredientSection[] => {
  const raw = Array.isArray(recipe.ingredientSections) && recipe.ingredientSections.length > 0
    ? recipe.ingredientSections
    : (recipe.ingredients ?? []).length > 0
      ? [{ title: 'Ingredients', items: recipe.ingredients ?? [] }]
      : [];

  return expandNestedSections(raw)
    .filter(s => Array.isArray(s?.items))
    .map(s => ({
      title: typeof s.title === 'string' && s.title.trim() ? s.title : 'Ingredients',
      items: s.items.map(readIngredient).filter(Boolean) as IngredientItem[],
    }))
    .filter(s => s.items.length > 0);
};

const getAllIngredients = (recipe: Recipe): IngredientItem[] =>
  getIngredientSections(recipe).flatMap(s => s.items);

// `quantity` (+ optional `unit`) is the current shape; `amount` is the legacy one.
const getIngredientAmount = (ing: IngredientItem): string => {
  const qty = String(ing.quantity ?? (ing as any).amount ?? '').trim();
  const unit = ing.unit?.trim();
  if (!unit || qty.toLowerCase().includes(unit.toLowerCase())) return qty;
  return `${qty} ${unit}`.trim();
};

const Recipes: React.FC = () => {
  const { skillLevel, filterRecipes: filterBySkill, getSkillLabel } = useCookingSkill();
  const { spiceTolerance, currentSpiceLabel, filterRecipesBySpice } = useSpiceTolerance();
  const { toggleFavorite, isFavorite, toggleSavedForLater, isSavedForLater, cacheRecipe, addFavorite, removeFavorite, addSavedForLater, removeSavedForLater } = useFavorites();
  const { showUndo } = useUndo();
  const { allergies, filterRecipesByAllergy, getExcludedRecipesInfo } = useAllergy();
  const { notifyInteraction, isWalkthroughActive } = useWalkthrough();
  const { addToRecentlyViewed } = useRecentlyViewed();
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingFav, setAnimatingFav] = useState<string | null>(null);
  const [animatingSave, setAnimatingSave] = useState<string | null>(null);
  const [showTimer, setShowTimer] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [timerStepName, setTimerStepName] = useState<string | undefined>();
  const [timerPosition, setTimerPosition] = useState<{ x: number; y: number } | undefined>();
  
  // Servings start at 1 so the number you pick IS the number of servings you get:
  // 1 = one serving, 2 = two, and so on. The AI writes its amounts for
  // `recipe.servings`, so that stays the base everything is scaled *from*.
  const getSelectedServings = (recipe: Recipe): number => {
    return recipeServings[recipe.id] ?? 1;
  };

  // Update servings for a specific recipe
  const updateRecipeServings = (recipeId: string, newServings: number) => {
    const clamped = Math.max(1, Math.min(12, newServings));
    setRecipeServings(prev => ({ ...prev, [recipeId]: clamped }));
  };

  // Parse amount string to extract numeric value and unit
  const parseAmount = (amount: string): { value: number; unit: string; original: string } => {
    const original = amount;
    // Handle fractions like ½, ¼, ¾
    const fractionMap: Record<string, number> = {
      '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 0.333, '⅔': 0.667,
      '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875
    };
    
    let text = amount.trim();
    let value = 0;
    
    // Check for whole number + fraction (e.g., "1 ½")
    const mixedMatch = text.match(/^(\d+)\s*([½¼¾⅓⅔⅛⅜⅝⅞])/);
    if (mixedMatch) {
      value = parseInt(mixedMatch[1]) + (fractionMap[mixedMatch[2]] || 0);
      text = text.replace(mixedMatch[0], '').trim();
    } else {
      // Check for standalone fraction
      for (const [frac, num] of Object.entries(fractionMap)) {
        if (text.includes(frac)) {
          value += num;
          text = text.replace(frac, '').trim();
        }
      }
      // Check for numeric value
      const numMatch = text.match(/^([\d.]+)/);
      if (numMatch) {
        value += parseFloat(numMatch[1]);
        text = text.replace(numMatch[0], '').trim();
      }
    }
    
    return { value: value || 1, unit: text, original };
  };

  // Format a number to a readable value (handle fractions)
  const formatAmount = (value: number, unit: string): string => {
    if (value === 0) return `0 ${unit}`.trim();
    
    // Round to reasonable precision
    const rounded = Math.round(value * 4) / 4; // Round to nearest 0.25
    
    // Convert to fraction if close to common fractions
    const fractions: [number, string][] = [
      [0.25, '¼'], [0.5, '½'], [0.75, '¾'],
      [0.333, '⅓'], [0.667, '⅔']
    ];
    
    const whole = Math.floor(rounded);
    const decimal = rounded - whole;
    
    let result = '';
    if (whole > 0) result = whole.toString();
    
    // Find closest fraction
    let foundFraction = false;
    for (const [val, frac] of fractions) {
      if (Math.abs(decimal - val) < 0.1) {
        result += (result ? ' ' : '') + frac;
        foundFraction = true;
        break;
      }
    }
    
    if (!foundFraction && decimal > 0) {
      // Use decimal format
      result = rounded.toFixed(rounded < 10 ? 1 : 0).replace(/\.0$/, '');
    }
    
    return `${result} ${unit}`.trim();
  };

  // Scale an ingredient amount based on serving ratio
  const scaleAmount = (amount: string, baseServings: number, targetServings: number): string => {
    if (baseServings === targetServings) return amount;
    if (!amount || amount === '—' || amount.toLowerCase() === 'to taste') return amount;
    
    const ratio = targetServings / baseServings;
    const { value, unit } = parseAmount(amount);
    const scaledValue = value * ratio;
    
    return formatAmount(scaledValue, unit);
  };

  const extractTimeFromStep = (step: string): number | null => {
    const patterns = [
      /(\d+)\s*(?:to\s*\d+\s*)?minutes?/i,
      /(\d+)\s*(?:to\s*\d+\s*)?mins?/i,
      /(\d+)\s*(?:-\s*\d+\s*)?minutes?/i,
      /(\d+)\s*hours?/i,
    ];
    for (const pattern of patterns) {
      const match = step.match(pattern);
      if (match) {
        const time = parseInt(match[1]);
        if (pattern.source.includes('hour')) {
          return time * 60;
        }
        return time;
      }
    }
    return null;
  };

  const openTimerForStep = (step: string, stepNumber: number, clickY?: number) => {
    const extractedTime = extractTimeFromStep(step);
    setTimerMinutes(extractedTime || 5);
    setTimerStepName(`Step ${stepNumber}`);
    if (clickY !== undefined) {
      setTimerPosition({ x: 0, y: clickY });
    }
    setShowTimer(true);
  };
  
  // Helper to load persisted state
  const loadState = () => {
    try {
      const saved = sessionStorage.getItem(RECIPE_STATE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to load recipe state", e);
      return null;
    }
  };

  const saved = loadState();
  const persistedPrefs = loadPersistedPrefs();

  const [recipes, setRecipes] = useState<Recipe[]>(saved?.recipes || []);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const waiting = useWaitMessage(loading);
  const waitingMore = useWaitMessage(loadingMore);
  const [hasGenerated, setHasGenerated] = useState(saved?.hasGenerated || false);
  const [items, setItems] = useState<PantryItem[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // New State for "I want to cook..."
  const [dishSearch, setDishSearch] = useState(saved?.dishSearch || "");
  const [servings, setServings] = useState(saved?.servings || 4);
  const [isSearchingDish, setIsSearchingDish] = useState(saved?.isSearchingDish || false);
  
  // Per-recipe serving selections: { recipeId: selectedServings }
  const [recipeServings, setRecipeServings] = useState<Record<string, number>>(saved?.recipeServings || {});

  // Filters - load from localStorage for persistence across sessions
  const [preferences, setPreferencesState] = useState<RecipePreferences>(
    persistedPrefs || saved?.preferences || {
      diet: 'None',
      cuisine: 'Any',
      mode: 'Standard'
    }
  );
  
  const setPreferences = (newPrefs: RecipePreferences) => {
    setPreferencesState(newPrefs);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(newPrefs)); } catch {}
    }
  };
  
  const filterByPreferences = (recipeList: Recipe[]): Recipe[] => {
    return recipeList.filter(recipe => {
      const tags = recipe.tags?.map(t => t.toLowerCase()) || [];
      const title = recipe.title?.toLowerCase() || '';
      const desc = recipe.description?.toLowerCase() || '';
      const combined = [...tags, title, desc].join(' ');
      
      // DIET FILTER - strict matching
      if (preferences.diet !== 'None') {
        const dietLower = preferences.diet.toLowerCase();
        const hasDietTag = tags.some(tag => 
          tag.includes(dietLower) || 
          (dietLower === 'vegetarian' && tag.includes('veggie')) ||
          (dietLower === 'gluten-free' && (tag.includes('gluten-free') || tag.includes('glutenfree')))
        );
        if (!hasDietTag && !combined.includes(dietLower)) return false;
      }
      
      // CUISINE FILTER - strict matching
      if (preferences.cuisine !== 'Any') {
        const cuisineLower = preferences.cuisine.toLowerCase();
        const hasCuisineTag = tags.some(tag => tag.includes(cuisineLower));
        if (!hasCuisineTag && !combined.includes(cuisineLower)) return false;
      }
      
      // MODE FILTER
      const totalTime = (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0);
      switch (preferences.mode) {
        case 'Quick':
          if (totalTime > 30) return false;
          break;
        case 'Budget':
          if (recipe.costTier !== 'Low') return false;
          break;
        case 'Healthy':
          if (recipe.healthScore !== undefined && recipe.healthScore < 6) return false;
          break;
        case 'PantryHero':
          const missingCount = getAllIngredients(recipe).filter(i => i.status === 'Missing').length;
          if (missingCount > 3) return false;
          break;
      }
      
      return true;
    });
  };
  
  const filteredRecipes = useMemo(() => {
    // Skip filtering for directly searched dishes (user explicitly requested this dish)
    if (isSearchingDish && dishSearch.trim()) {
      return recipes;
    }
    const allergyFiltered = filterRecipesByAllergy(recipes);
    const skillFiltered = filterBySkill(allergyFiltered);
    const spiceFiltered = filterRecipesBySpice(skillFiltered);
    return filterByPreferences(spiceFiltered);
  }, [recipes, skillLevel, spiceTolerance, preferences, allergies, isSearchingDish, dishSearch]);
  
  // Skill and spice filter results too, and they live in Settings rather than on this
  // screen — so an empty list could look like a bug. Name everything that's filtering.
  const activeFilterSummary = useMemo(() => {
    const active: string[] = [];
    if (preferences.diet && preferences.diet !== 'None') active.push(`Diet: ${preferences.diet}`);
    if (preferences.cuisine && preferences.cuisine !== 'Any') active.push(`Cuisine: ${preferences.cuisine}`);
    if (preferences.mode && preferences.mode !== 'Standard') active.push(`Mode: ${preferences.mode}`);
    if (skillLevel) active.push(`Skill: ${getSkillLabel()}`);
    if (currentSpiceLabel) active.push(`Spice: ${currentSpiceLabel}`);
    if (allergies.length > 0) active.push(`Allergies: ${allergies.join(', ')}`);
    return active;
  }, [preferences, skillLevel, getSkillLabel, currentSpiceLabel, allergies]);

  const excludedByAllergy = useMemo(() => {
    return getExcludedRecipesInfo(recipes);
  }, [recipes, allergies]);

  // Generate "Why This Recipe?" reasons based on active filters
  const getRecipeReasons = (recipe: Recipe): { icon: string; text: string; color: string }[] => {
    const reasons: { icon: string; text: string; color: string }[] = [];
    const tags = recipe.tags?.map(t => t.toLowerCase()) || [];
    const title = recipe.title?.toLowerCase() || '';
    const desc = recipe.description?.toLowerCase() || '';
    const combined = [...tags, title, desc].join(' ');
    const totalTime = (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0);

    // Check diet match
    if (preferences.diet !== 'None') {
      const dietLower = preferences.diet.toLowerCase();
      const hasDietMatch = tags.some(tag => 
        tag.includes(dietLower) || 
        (dietLower === 'vegetarian' && tag.includes('veggie')) ||
        (dietLower === 'gluten-free' && (tag.includes('gluten-free') || tag.includes('glutenfree')))
      ) || combined.includes(dietLower);
      if (hasDietMatch) {
        reasons.push({ icon: '✅', text: `${preferences.diet}`, color: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' });
      }
    }

    // Check cuisine match
    if (preferences.cuisine !== 'Any') {
      const cuisineLower = preferences.cuisine.toLowerCase();
      const hasCuisineMatch = tags.some(tag => tag.includes(cuisineLower)) || combined.includes(cuisineLower);
      if (hasCuisineMatch) {
        reasons.push({ icon: '🌍', text: `${preferences.cuisine}`, color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' });
      }
    }

    // Check mode match
    if (preferences.mode !== 'Standard') {
      let modeMatch = false;
      switch (preferences.mode) {
        case 'Quick':
          modeMatch = totalTime <= 30;
          break;
        case 'Budget':
          modeMatch = recipe.costTier === 'Low';
          break;
        case 'Healthy':
          modeMatch = recipe.healthScore !== undefined && recipe.healthScore >= 6;
          break;
        case 'PantryHero':
          const missingCount = getAllIngredients(recipe).filter(i => i.status === 'Missing').length;
          modeMatch = missingCount <= 3;
          break;
        case 'LeftoverFusion':
          modeMatch = true;
          break;
      }
      if (modeMatch) {
        const modeIcons: Record<string, string> = {
          'Quick': '⚡',
          'Budget': '💰',
          'Healthy': '🥗',
          'PantryHero': '🦸',
          'LeftoverFusion': '🔄'
        };
        reasons.push({ icon: modeIcons[preferences.mode] || '⚡', text: `${preferences.mode}`, color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' });
      }
    }

    // Check allergy safety
    if (allergies.length > 0 && recipe.safe !== false) {
      reasons.push({ icon: '🛡️', text: 'Allergy Safe', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' });
    }

    // Check difficulty match
    if (recipe.difficulty) {
      const difficultyToSkill: Record<string, number> = { 'Easy': 2, 'Medium': 3, 'Hard': 4, 'Expert': 5 };
      const recipeDifficulty = difficultyToSkill[recipe.difficulty] || 3;
      if (recipeDifficulty <= skillLevel) {
        reasons.push({ icon: '👨‍🍳', text: `${recipe.difficulty} Level`, color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' });
      }
    }

    // If no specific reasons, show default
    if (reasons.length === 0) {
      reasons.push({ icon: '✨', text: 'Recommended for you', color: 'bg-gray-50 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400' });
    }

    // Limit to 4 reasons max
    return reasons.slice(0, 4);
  };
  
  useEffect(() => {
    if (recipes.length > 0) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [skillLevel, spiceTolerance, preferences]);
  const [showFilters, setShowFilters] = useState(saved?.showFilters || false);
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(saved?.expandedRecipe || null);
  const [addedToCart, setAddedToCart] = useState<Set<string>>(
    saved?.addedToCart ? new Set(saved.addedToCart) : new Set()
  );

  useEffect(() => {
    setItems(getItems());
    setUserProfile(getUserProfile());
  }, []);

  // Opening a saved recipe (Recently Viewed / Favourites / Saved for Later) shows the
  // stored one as-is. Regenerating it from the title gave a different dish each time.
  useEffect(() => {
    const stored = takeQueuedRecipe();
    if (stored) {
      setRecipes([stored]);
      setExpandedRecipe(stored.id);
      setHasGenerated(true);
      setIsSearchingDish(true);   // don't filter a recipe the user explicitly opened
      setDishSearch(stored.title);
    }
  }, []);

  // Check for quick search from Recently Viewed
  useEffect(() => {
    const quickSearch = sessionStorage.getItem('smart_pantry_quick_search');
    if (quickSearch) {
      sessionStorage.removeItem('smart_pantry_quick_search');
      setDishSearch(quickSearch);
      setIsSearchingDish(true);
      
      // Auto-trigger search after short delay to allow state to settle
      setTimeout(async () => {
        setLoading(true);
        setExpandedRecipe(null);
        try {
          const pantryItems = getItems();
          const result = await generateRecipeFromDish(quickSearch, pantryItems, servings, getUserProfile() || undefined);
          if (result) {
            setRecipes([result]);
            setExpandedRecipe(result.id);
          }
        } catch (err) {
          console.error("Error generating recipe:", err);
        }
        setLoading(false);
        setHasGenerated(true);
      }, 100);
    }
  }, []);

  // Save state to sessionStorage whenever it changes
  useEffect(() => {
    const stateToSave = {
      recipes,
      hasGenerated,
      dishSearch,
      servings,
      isSearchingDish,
      preferences,
      showFilters,
      expandedRecipe,
      addedToCart: Array.from(addedToCart),
      recipeServings
    };
    sessionStorage.setItem(RECIPE_STATE_KEY, JSON.stringify(stateToSave));
  }, [recipes, hasGenerated, dishSearch, servings, isSearchingDish, preferences, showFilters, expandedRecipe, addedToCart, recipeServings]);

  const expiringItems = items.filter(i => {
    if (!i.expiryDate) return false;
    const diff = new Date(i.expiryDate).getTime() - new Date().getTime();
    return diff < 5 * 24 * 3600 * 1000;
  });

  const handleGenerate = async () => {
    console.log("handleGenerate called, items:", items.length);
    if (items.length === 0) {
      alert("Add items to your pantry first!");
      return;
    }
    setLoading(true);
    setExpandedRecipe(null);
    setIsSearchingDish(false);
    try {
      // Pass userProfile to service
      const result = await suggestRecipes(items, preferences, userProfile || undefined);
      console.log("Recipes received:", result?.length);
      setRecipes(result);
    } catch (err) {
      console.error("Error generating recipes:", err);
      alert("Failed to generate recipes. Please try again.");
    }
    setLoading(false);
    setHasGenerated(true);
  };

  // Fetches another batch and appends it, telling the AI what's already on screen so
  // it doesn't repeat dishes. Useful when the allergy/skill/spice filters thin the list.
  const handleGenerateMore = async () => {
    if (items.length === 0) return;
    setLoadingMore(true);
    try {
      const seen = recipes.map(r => r.title);
      const more = await suggestRecipes(items, preferences, userProfile || undefined, seen);
      const seenLower = new Set(seen.map(t => t.toLowerCase().trim()));
      const fresh = (more || []).filter(r => r?.title && !seenLower.has(r.title.toLowerCase().trim()));
      if (fresh.length === 0) {
        alert("Couldn't find any new recipes for this pantry — try changing your preferences or adding items.");
      } else {
        setRecipes(prev => [...prev, ...fresh]);
      }
    } catch (err) {
      console.error("Error generating more recipes:", err);
      alert("Failed to load more recipes. Please try again.");
    }
    setLoadingMore(false);
  };

  const handleDishSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishSearch.trim()) return;
    
    setLoading(true);
    setExpandedRecipe(null);
    setIsSearchingDish(true);
    
    try {
      // Pass userProfile to service (API key is handled server-side)
      const recipe = await generateRecipeFromDish(dishSearch, items, servings, userProfile || undefined);
      
      if (recipe) {
        setRecipes([recipe]);
        setExpandedRecipe(recipe.id);
      } else {
        alert("Could not find a recipe for that dish. Try a more common name or check your internet connection.");
      }
    } catch (error) {
      console.error("Recipe search error:", error);
      alert("An error occurred while searching for the recipe. Please try again.");
    }
    
    setLoading(false);
    setHasGenerated(true);
  };

  const toggleRecipe = (id: string) => {
    const isExpanding = expandedRecipe !== id;
    setExpandedRecipe(isExpanding ? id : null);
    
    if (isExpanding) {
      const recipe = recipes.find(r => r.id === id);
      if (recipe) {
        addToRecentlyViewed(recipe);
      }
    } else {
      setShowTimer(false);
    }
  };

  const handleAddToCart = (ingredient: IngredientItem) => {
    const amountToAdd = ingredient.amountToBuy || getIngredientAmount(ingredient) || '1 unit';
    const nameToAdd = ingredient.name + (ingredient.amountToBuy ? " (Partial fill)" : "");
    addToShoppingList(nameToAdd, amountToAdd);
    setAddedToCart(prev => new Set(prev).add(ingredient.name));
  };

  const handleBulkAddToCart = (recipe: Recipe) => {
    const missing = getAllIngredients(recipe).filter(i => i.status === 'Missing' || i.status === 'Partial');
    let count = 0;
    missing.forEach(ing => {
      if (!addedToCart.has(ing.name)) {
        handleAddToCart(ing);
        count++;
      }
    });
    if (count > 0) alert(`Added ${count} items to shopping list.`);
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'Quick': return <Clock size={16} />;
      case 'Healthy': return <Heart size={16} />;
      case 'PantryHero': return <Flame size={16} />;
      case 'Budget': return <DollarSign size={16} />;
      case 'LeftoverFusion': return <Sparkles size={16} />;
      default: return <ChefHat size={16} />;
    }
  };

  // Looks up a real cooking video for the dish. Only mounts when a card is expanded,
  // so we don't hit the lookup for recipes nobody opened.
  // presetUrl is the video pinned to the recipe when it was generated. When it's there
  // we never look anything up, so the same recipe always shows the same video.
  const RecipeVideo = ({
    dishName,
    presetUrl,
    presetTitle,
  }: { dishName: string; presetUrl?: string; presetTitle?: string }) => {
    const [embedUrl, setEmbedUrl] = useState<string | null>(presetUrl ?? null);
    const [watchUrl, setWatchUrl] = useState<string | null>(null);
    const [videoTitle, setVideoTitle] = useState<string | null>(presetTitle ?? null);
    const [state, setState] = useState<'loading' | 'ready' | 'failed'>(presetUrl ? 'ready' : 'loading');

    useEffect(() => {
      if (presetUrl) return;
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch('/api/gemini/find-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dishName }),
          });
          if (!res.ok) throw new Error('lookup failed');
          const data = await res.json();
          if (cancelled) return;
          setWatchUrl(data.watchUrl ?? null);
          setVideoTitle(data.title ?? null);
          setEmbedUrl(data.embedUrl ?? null);
          setState(data.embedUrl ? 'ready' : 'failed');
        } catch {
          if (!cancelled) setState('failed');
        }
      })();
      return () => { cancelled = true; };
    }, [dishName, presetUrl]);

    return (
      <div className="mb-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg">
            <Play size={16} />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">Watch How It's Made</h4>
            {videoTitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{videoTitle}</p>
            )}
          </div>
        </div>

        {state === 'loading' && (
          <div className="w-full aspect-video rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        )}

        {state === 'ready' && embedUrl && (
          <VideoPlayer videoUrl={embedUrl} title={dishName} />
        )}

        {state === 'failed' && (
          <a
            href={watchUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(dishName + ' recipe')}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Play size={16} /> Search YouTube for this recipe
          </a>
        )}
      </div>
    );
  };

  // Improved Image Component
  const RecipeImage = ({ keyword, title }: { keyword?: string; title: string }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    const releaseSlot = useRef<(() => void) | null>(null);

    useEffect(() => {
      const url = buildRecipeImageUrl(keyword, title, attempt, userProfile?.settings?.aiPersona?.photoStyle);
      // Only the Pollinations attempt has to queue; the stock-photo fallbacks are
      // happy to load in parallel.
      if (attempt > 0) {
        releaseSlot.current = null;
        setImageUrl(url);
        return;
      }
      const release = acquireImageSlot(() => setImageUrl(url));
      releaseSlot.current = release;
      return release;   // unmounting, or moving to the next attempt, frees the slot
    }, [keyword, title, attempt, userProfile?.settings?.aiPersona?.photoStyle]);

    const handleLoaded = () => {
      setIsLoaded(true);
      releaseSlot.current?.();
    };

    const handleFailed = () => {
      releaseSlot.current?.();
      if (attempt + 1 < IMAGE_MAX_ATTEMPTS) {
        setAttempt(a => a + 1);   // re-queues via the effect
      } else {
        setHasError(true);
      }
    };

    return (
      <div className="relative w-full aspect-video overflow-hidden bg-gray-100 dark:bg-gray-800">
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700 animate-pulse">
            <ChefHat className="text-gray-400 opacity-50" size={32} />
          </div>
        )}
        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-200 dark:bg-gray-700">
             <ImageOff className="text-gray-400 mb-2" size={32} />
             <span className="text-xs text-gray-500 font-medium">Image unavailable</span>
          </div>
        ) : imageUrl && (
          <img
            key={imageUrl}
            src={imageUrl}
            alt={title}
            className={`w-full h-full object-cover transition-all duration-700 hover:scale-105 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={handleLoaded}
            onError={handleFailed}
          />
        )}
        {/* Cinematic Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>
      </div>
    );
  };

  return (
    <div className="p-4 pb-28 min-h-screen transition-colors duration-300">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold text-gray-800 dark:text-white mb-6">Chef's Table</h1>

        {/* Dish Search Input */}
        <div className="bg-white dark:bg-gray-800 p-2 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 mb-6 relative z-10">
          <form onSubmit={handleDishSearch} className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
              <input 
                type="text"
                value={dishSearch}
                onChange={(e) => setDishSearch(e.target.value)}
                placeholder="I want to cook..."
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-700 border-transparent focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-green-500 outline-none font-medium text-gray-800 dark:text-gray-100 placeholder-gray-400"
              />
            </div>
            <button 
              type="submit"
              disabled={loading || !dishSearch}
              className="p-3 bg-gray-900 dark:bg-green-600 text-white rounded-2xl hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
            >
              <ArrowRight size={20} />
            </button>
          </form>
        </div>

        {/* Filters Toggle */}
        <div className="flex justify-between items-center mb-4">
           <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide">
             {hasGenerated ? 'Results' : 'Suggestions'}
           </h2>
           <button 
             data-walkthrough="preferences-btn"
             onClick={() => {
               setShowFilters(!showFilters);
               if (isWalkthroughActive) {
                 notifyInteraction("[data-walkthrough='preferences-btn']");
               }
             }}
             className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-green-100 dark:hover:bg-green-900/50"
           >
             <Filter size={12} /> {showFilters ? 'Hide Preferences' : 'Preferences'}
           </button>
        </div>

        {showFilters && (
            <div data-walkthrough="filters" className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-2">
               {/* Mode Selection */}
               <div data-walkthrough="mode-selector" className="mb-4">
                 <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Mode</label>
                 <div className="grid grid-cols-2 gap-2">
                   {['Standard', 'Quick', 'Healthy', 'PantryHero', 'Budget', 'LeftoverFusion'].map(m => (
                     <button
                       key={m}
                       onClick={() => {
                         setPreferences({...preferences, mode: m as any});
                         if (isWalkthroughActive) {
                           notifyInteraction("[data-walkthrough='mode-selector']");
                         }
                       }}
                       className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold border transition-all ${
                         preferences.mode === m 
                           ? 'bg-green-600 border-green-600 text-white shadow-md' 
                           : 'bg-white dark:bg-gray-700 border-gray-100 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                       }`}
                     >
                       <div className={preferences.mode === m ? 'text-white' : 'text-green-600 dark:text-green-400'}>
                         {getModeIcon(m)}
                       </div>
                       {m === 'PantryHero' ? 'Pantry Hero' : m === 'LeftoverFusion' ? 'Remix' : m}
                     </button>
                   ))}
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Diet</label>
                   <select 
                      value={preferences.diet}
                      onChange={(e) => setPreferences({...preferences, diet: e.target.value as any})}
                      className="w-full text-sm p-2 rounded-xl bg-gray-50 dark:bg-gray-700 border-none font-medium text-gray-800 dark:text-gray-100"
                   >
                     {['None', 'Vegetarian', 'Vegan', 'Keto', 'Gluten-Free', 'Paleo'].map(d => (
                       <option key={d} value={d}>{d}</option>
                     ))}
                   </select>
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">Cuisine</label>
                   <select 
                      value={preferences.cuisine}
                      onChange={(e) => setPreferences({...preferences, cuisine: e.target.value as any})}
                      className="w-full text-sm p-2 rounded-xl bg-gray-50 dark:bg-gray-700 border-none font-medium text-gray-800 dark:text-gray-100"
                   >
                     {['Any', 'Italian', 'Mexican', 'Asian', 'American', 'Indian', 'Mediterranean'].map(c => (
                       <option key={c} value={c}>{c}</option>
                     ))}
                   </select>
                 </div>
               </div>

               {/* Changing preferences only re-filters the recipes already on screen, so
                   without this there was no way to actually ask for new ones that match
                   a new diet or cuisine — and "Surprise Me" is gone once results exist. */}
               {hasGenerated && !isSearchingDish && (
                 <button
                   type="button"
                   data-walkthrough="regenerate"
                   onClick={() => {
                     handleGenerate();
                     if (isWalkthroughActive) notifyInteraction("[data-walkthrough='regenerate']");
                   }}
                   disabled={loading}
                   className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold text-sm shadow-lg shadow-green-500/30 flex items-center justify-center gap-2 disabled:opacity-50 tap-scale"
                 >
                   <Sparkles size={16} />
                   {loading ? 'Cooking up new ideas…' : 'Generate new recipes'}
                 </button>
               )}
            </div>
          )}
      </header>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative mb-6">
             <div className="absolute inset-0 bg-green-500 rounded-full opacity-20 animate-ping"></div>
             <div className="relative bg-white dark:bg-gray-800 p-4 rounded-full shadow-lg">
               <ChefHat size={40} className="text-green-600 dark:text-green-400" />
             </div>
          </div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">
            {isSearchingDish ? `Deconstructing ${dishSearch}...` : 'Developing flavors...'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-[200px]">
            AI is checking your pantry against culinary databases.
          </p>
          {waiting.message && (
            <div className="mt-5 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 max-w-[280px] animate-in fade-in">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 leading-relaxed">
                {waiting.message}
              </p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                {waiting.elapsedSeconds}s elapsed
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main Action (Empty State) */}
      {!loading && !hasGenerated && (
        <div className="text-center py-8">
           <button 
             type="button"
             data-walkthrough="surprise-me"
             onClick={() => {
               handleGenerate();
               if (isWalkthroughActive) {
                 notifyInteraction("[data-walkthrough='surprise-me']");
               }
             }}
             style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(0,128,0,0.3)' }}
             className="w-full h-40 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border-2 border-gray-100 dark:border-gray-600 flex items-center justify-center mb-6 overflow-hidden relative cursor-pointer active:bg-green-100 dark:active:bg-green-900/50 transition-colors select-none focus:outline-none focus:ring-2 focus:ring-green-500"
           >
              <div className="absolute inset-0 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 opacity-50 pointer-events-none"></div>
              <div className="flex flex-col items-center pointer-events-none">
                 <UtensilsCrossed size={48} className="text-green-300 dark:text-green-700 mb-2" />
                 <span className="font-bold text-gray-600 dark:text-gray-300">Surprise Me</span>
                 <span className="text-xs text-gray-400 dark:text-gray-500">Based on your {items.length} items</span>
              </div>
           </button>
           
           {expiringItems.length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-4 text-left flex gap-3 border border-orange-100 dark:border-orange-800/30">
                 <div className="bg-white dark:bg-gray-800 p-2 rounded-full h-fit shadow-sm text-orange-500">
                    <Flame size={18} />
                 </div>
                 <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Food Waste Alert</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      We'll prioritize using your <b>{expiringItems[0].name}</b> and {expiringItems.length - 1} others.
                    </p>
                 </div>
              </div>
           )}
        </div>
      )}

      {/* Filter Indicators */}
      {hasGenerated && filteredRecipes.length > 0 && (
        <div className={`space-y-2 mb-4 transition-all duration-300 ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800/30">
            <Award size={16} className="text-orange-500" />
            <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
              {skillLevel} skill • {currentSpiceLabel} spice
              {preferences.diet !== 'None' && ` • ${preferences.diet}`}
              {preferences.cuisine !== 'Any' && ` • ${preferences.cuisine}`}
              {preferences.mode !== 'Standard' && ` • ${preferences.mode}`}
            </span>
            {recipes.length !== filteredRecipes.length && (
              <span className="ml-auto text-xs text-orange-500 dark:text-orange-400">
                {filteredRecipes.length} of {recipes.length}
              </span>
            )}
          </div>
          {excludedByAllergy.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800/30">
              <AlertTriangle size={16} className="text-red-500" />
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                {excludedByAllergy.length} recipe{excludedByAllergy.length !== 1 ? 's' : ''} hidden due to allergies
              </span>
            </div>
          )}
        </div>
      )}

      {/* No Recipes Match Message */}
      {hasGenerated && recipes.length > 0 && filteredRecipes.length === 0 && (
        <div className={`text-center py-12 transition-all duration-300 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <Filter size={32} className="text-gray-400" />
          </div>
          {/* This is a filter result, not a failure — but it read like an error, because
              changing a preference only hides the recipes already on screen. Say which
              settings are doing the hiding, and offer the fix right here. */}
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">
            Nothing here matches your settings
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
            This isn't an error — the {recipes.length} recipe{recipes.length === 1 ? '' : 's'} already
            loaded {recipes.length === 1 ? "doesn't" : "don't"} fit. Preferences filter what's on
            screen; generate again to get recipes built for these settings.
          </p>

          {activeFilterSummary.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center mt-4 max-w-xs mx-auto">
              {activeFilterSummary.map(f => (
                <span key={f} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {f}
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="mt-6 px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 text-white font-bold text-sm shadow-lg shadow-green-500/30 inline-flex items-center gap-2 disabled:opacity-50 tap-scale"
          >
            <Sparkles size={16} />
            {loading ? 'Cooking up new ideas…' : 'Generate recipes for these settings'}
          </button>
        </div>
      )}

      {/* Results List */}
      <div data-walkthrough="recipe-cards" className={`space-y-8 transition-all duration-300 ${isAnimating ? 'opacity-50 scale-[0.98]' : 'opacity-100 scale-100'}`}>
        {filteredRecipes.map((recipe, index) => {
          const isExpanded = expandedRecipe === recipe.id;
          const missingItems = getAllIngredients(recipe).filter(i => i.status === 'Missing' || i.status === 'Partial');
          const missingCount = missingItems.length;

          return (
            <div 
              key={recipe.id} 
              data-walkthrough={index === 0 ? "recipe-detail" : undefined}
              className="bg-white dark:bg-gray-800 rounded-[32px] shadow-card overflow-hidden transition-all duration-300 transform border border-gray-100 dark:border-gray-700 animate-fade-in-up opacity-0 hover:shadow-lg"
              style={{ animationDelay: `${Math.min(index * 0.08, 0.4)}s` }}
            >
              
              {/* === CARD IMAGE HERO === */}
              <div onClick={() => {
                toggleRecipe(recipe.id);
                if (index === 0 && isWalkthroughActive) {
                  notifyInteraction("[data-walkthrough='recipe-detail']");
                }
              }} className="cursor-pointer group relative">
                 <RecipeImage keyword={recipe.imageKeyword} title={recipe.title} />
                 
                 {/* Top Badges Row - positioned absolutely within relative parent */}
                 <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
                    <div className="flex gap-2 flex-wrap">
                      {/* Match Badge */}
                      <div className={`px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 ${
                          recipe.matchScore >= 80 
                            ? 'bg-green-500 text-white' 
                            : 'bg-amber-500 text-white'
                        }`}>
                          <span className="text-xs font-bold">{recipe.matchScore}%</span>
                      </div>
                      {/* Video Badge — every recipe gets a video looked up on open */}
                      {(
                        <div className="px-3 py-1.5 rounded-full shadow-lg bg-red-500 text-white flex items-center gap-1.5">
                          <Play size={11} fill="currentColor" />
                          <span className="text-xs font-bold">Video</span>
                        </div>
                      )}
                    </div>
                    {/* Needs Items Badge - top right */}
                    {missingCount > 0 && (
                      <div className="px-3 py-1.5 rounded-full shadow-lg bg-gray-900/80 text-white flex items-center gap-1.5">
                        <ShoppingCart size={11} />
                        <span className="text-xs font-bold">+{missingCount}</span>
                      </div>
                    )}
                 </div>

                 {/* Bottom Text Overlay with strong gradient */}
                 <div className="absolute bottom-0 left-0 right-0 p-5 pt-16 bg-gradient-to-t from-black via-black/70 to-transparent z-10">
                    <h3 className="text-xl font-bold text-white leading-snug mb-2 line-clamp-2" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                      {recipe.title}
                    </h3>
                    <div className="flex items-center gap-4 text-white/95 text-xs font-semibold">
                       <span className="flex items-center gap-1.5"><Clock size={13} /> {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min</span>
                       <span className="flex items-center gap-1.5"><Leaf size={13} /> {recipe.nutrition.calories} cal</span>
                       {recipe.spiciness && recipe.spiciness > 0 && (
                         <span className="flex items-center gap-1.5"><Flame size={13} className={recipe.spiciness > 2 ? 'text-red-400' : 'text-amber-400'} /> {recipe.spiciness > 2 ? 'Hot' : 'Mild'}</span>
                       )}
                    </div>
                 </div>
              </div>

              {/* === CARD BODY === */}
              <div className="p-5 pt-4">
                 {/* Status Badges Row */}
                 <div className="flex flex-wrap gap-2 mb-3">
                    {recipe.safe === false && (
                      <span className="text-[11px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <AlertTriangle size={12} /> Allergen Alert
                      </span>
                    )}
                    {missingCount === 0 && (
                       <span className="text-[11px] font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                         <CheckCircle2 size={12} /> Ready to Cook
                       </span>
                    )}
                 </div>

                 {/* Description with improved readability */}
                 <p className="text-sm text-gray-700 dark:text-gray-200 line-clamp-2 leading-relaxed mb-3">
                    {recipe.description}
                 </p>

                 {/* Why This Recipe? - Dynamic reasons based on filters */}
                 <div className="flex flex-wrap gap-1.5 mb-4">
                   {getRecipeReasons(recipe).map((reason, i) => (
                     <span 
                       key={i}
                       className={`text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${reason.color}`}
                     >
                       <span>{reason.icon}</span>
                       <span>{reason.text}</span>
                     </span>
                   ))}
                 </div>

                 {/* Action Buttons Row - separated from content */}
                 <div data-walkthrough={index === 0 ? "favorite-buttons" : undefined} className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       setAnimatingFav(recipe.id);
                       const wasAlreadyFavorite = isFavorite(recipe.id);
                       if (wasAlreadyFavorite) {
                         removeFavorite(recipe.id);
                         showUndo(
                           `"${recipe.title}" removed from favorites`,
                           () => addFavorite(recipe.id, recipe)
                         );
                       } else {
                         addFavorite(recipe.id, recipe);
                       }
                       setTimeout(() => setAnimatingFav(null), 300);
                       if (index === 0 && isWalkthroughActive) {
                         notifyInteraction("[data-walkthrough='favorite-buttons']");
                       }
                     }}
                     className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-150 tap-scale ${
                       isFavorite(recipe.id)
                         ? 'bg-red-500 text-white shadow-sm'
                         : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30'
                     } ${animatingFav === recipe.id ? 'scale-90' : 'scale-100'}`}
                   >
                     <Heart
                       size={16}
                       className={`transition-transform duration-200 ${animatingFav === recipe.id ? 'icon-pop' : ''}`}
                       fill={isFavorite(recipe.id) ? 'currentColor' : 'none'}
                     />
                     {isFavorite(recipe.id) ? 'Favorited' : 'Favorite'}
                   </button>
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       setAnimatingSave(recipe.id);
                       const wasAlreadySaved = isSavedForLater(recipe.id);
                       if (wasAlreadySaved) {
                         removeSavedForLater(recipe.id);
                         showUndo(
                           `"${recipe.title}" removed from saved`,
                           () => addSavedForLater(recipe.id, recipe)
                         );
                       } else {
                         addSavedForLater(recipe.id, recipe);
                       }
                       setTimeout(() => setAnimatingSave(null), 300);
                     }}
                     className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-150 tap-scale ${
                       isSavedForLater(recipe.id)
                         ? 'bg-blue-500 text-white shadow-sm'
                         : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                     } ${animatingSave === recipe.id ? 'scale-90' : 'scale-100'}`}
                   >
                     <Bookmark
                       size={16}
                       className={`transition-transform duration-200 ${animatingSave === recipe.id ? 'icon-pop' : ''}`}
                       fill={isSavedForLater(recipe.id) ? 'currentColor' : 'none'}
                     />
                     {isSavedForLater(recipe.id) ? 'Saved' : 'Save'}
                   </button>
                   {/* Expand/Collapse Toggle */}
                   <button 
                     onClick={() => toggleRecipe(recipe.id)}
                     className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all tap-scale"
                   >
                     {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                   </button>
                 </div>

                 {/* === EXPANDED DETAILS === */}
                 {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-4">
                    
                    {/* SERVINGS SELECTOR */}
                    <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500 text-white rounded-xl">
                          <Users size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">Servings</p>
                          <p className="text-lg font-extrabold text-gray-800 dark:text-white">
                            {getSelectedServings(recipe)}
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1">
                              {getSelectedServings(recipe) === 1 ? 'serving' : 'servings'}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateRecipeServings(recipe.id, getSelectedServings(recipe) - 1);
                          }}
                          disabled={getSelectedServings(recipe) <= 1}
                          className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xl flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all"
                        >
                          −
                        </button>
                        <div className="w-12 text-center font-extrabold text-xl text-gray-800 dark:text-white">
                          {getSelectedServings(recipe)}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateRecipeServings(recipe.id, getSelectedServings(recipe) + 1);
                          }}
                          disabled={getSelectedServings(recipe) >= 12}
                          className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xl flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Yield Note & Serving Scale Table */}
                    {(recipe.yieldNote || recipe.servingScaleMultipliers) && (
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 mb-6">
                        {recipe.yieldNote && (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">🍳</span>
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{recipe.yieldNote}</p>
                          </div>
                        )}
                        {recipe.servingScaleMultipliers && recipe.servingScaleMultipliers.length > 0 && (
                          <div>
                            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">Scaling Guide</p>
                            <div className="grid grid-cols-3 gap-2">
                              {recipe.servingScaleMultipliers.map((scale, idx) => (
                                <div key={idx} className="bg-white/60 dark:bg-gray-800/40 rounded-lg p-2 text-center">
                                  <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{scale.multiplier}</p>
                                  {/* servings count follows the base-1 selector: 1x = 1 serving, 2x = 2, 3x = 3 */}
                                  <p className="text-xs text-amber-600 dark:text-amber-400">{idx + 1} {idx === 0 ? 'serving' : 'servings'}</p>
                                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{scale.yield}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* VIDEO PLAYER */}
                    <RecipeVideo dishName={recipe.title} presetUrl={recipe.videoUrl} presetTitle={(recipe as any).videoTitle} />
                    
                    {/* ALLERGY WARNING BANNER */}
                    {recipe.allergenWarning && (
                      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 mb-6 rounded-r-xl">
                        <h4 className="text-red-800 dark:text-red-300 font-bold text-sm uppercase tracking-wide mb-1 flex items-center gap-2">
                           <AlertTriangle size={16} /> Safety Alert
                        </h4>
                        <p className="text-red-700 dark:text-red-400 text-sm font-medium leading-snug">
                          {recipe.allergenWarning}
                        </p>
                      </div>
                    )}

                    {/* Shopping Action Block */}
                    {missingItems.length > 0 && (
                      <div className="bg-stone-50 dark:bg-gray-700/30 border border-stone-200 dark:border-gray-600 rounded-2xl p-5 mb-8">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-2 bg-white dark:bg-gray-800 text-orange-600 dark:text-orange-400 rounded-lg shadow-sm">
                            <ShoppingCart size={16} />
                          </div>
                          <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">Missing Ingredients</h4>
                        </div>
                        <ul className="space-y-3 mb-4">
                          {missingItems.map((ing, i) => (
                             <li key={i} className="flex justify-between items-center text-sm border-b border-gray-200 dark:border-gray-600/50 last:border-0 pb-2 last:pb-0">
                               <span className="text-gray-600 dark:text-gray-300">{ing.name}</span>
                               <span className="font-bold text-gray-800 dark:text-gray-200 text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded-md shadow-sm transition-all duration-200">
                                 +{scaleAmount(ing.amountToBuy || getIngredientAmount(ing), recipe.servings, getSelectedServings(recipe))}
                               </span>
                             </li>
                          ))}
                        </ul>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleBulkAddToCart(recipe); }}
                          className="w-full py-3 bg-gray-900 dark:bg-green-600 text-white rounded-xl text-sm font-bold shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                        >
                          Add All to Cart
                        </button>
                      </div>
                    )}

                    {/* Ingredients - grouped by the recipe's own sections */}
                    <div className="mb-8">
                      <h4 className="font-heading font-bold text-gray-800 dark:text-white text-lg mb-4">Ingredients</h4>
                      {getIngredientSections(recipe).map((section, si) => (
                        <div key={si} className="mb-5 last:mb-0">
                          <h5 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500/60"></span>
                            {section.title}
                          </h5>
                          <ul className="space-y-2">
                            {section.items.map((ing, i) => (
                              <li key={i} className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${ing.isAllergen ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}>
                                 <div className={`mt-0.5 ${ing.isAllergen ? 'text-red-500' : ing.status === 'Have' ? 'text-green-500' : 'text-gray-300'}`}>
                                    {ing.isAllergen ? <AlertTriangle size={18} /> : ing.status === 'Have' ? <CheckCircle2 size={18} /> : <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />}
                                 </div>
                                 <div className="flex-1">
                                   <div className="flex justify-between items-baseline gap-2">
                                     <span className={`text-sm font-medium ${ing.isAllergen ? 'text-red-700 dark:text-red-400 font-bold' : ing.status === 'Have' ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
                                       {ing.name}
                                       {ing.isOptional && <span className="ml-1 text-[10px] text-gray-400 dark:text-gray-500 font-normal">(optional)</span>}
                                     </span>
                                     <span className="text-sm font-bold text-gray-800 dark:text-gray-300 transition-all duration-200 whitespace-nowrap">{scaleAmount(getIngredientAmount(ing), recipe.servings, getSelectedServings(recipe))}</span>
                                   </div>
                                   {ing.prepNote && (
                                     <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5 italic">{ing.prepNote}</p>
                                   )}
                                   {ing.cautionNote && (
                                     <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                                       <AlertTriangle size={10} /> {ing.cautionNote}
                                     </p>
                                   )}
                                   {ing.status !== 'Have' && !ing.isAllergen && (
                                     <p className="text-xs text-orange-500 font-medium mt-0.5">
                                       {ing.substitute ? `Sub: ${ing.substitute}` : `Missing`}
                                     </p>
                                   )}
                                 </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    {/* Instructions */}
                    <div>
                      <h4 className="font-heading font-bold text-gray-800 dark:text-white text-lg mb-4 flex items-center justify-between">
                        Instructions
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTimerMinutes(5);
                            setTimerStepName(undefined);
                            setTimerPosition({ x: 0, y: e.clientY });
                            setShowTimer(true);
                          }}
                          className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors"
                        >
                          <Timer size={14} /> Timer
                        </button>
                      </h4>
                      <div className="space-y-8 relative border-l-2 border-gray-100 dark:border-gray-700 ml-4 pl-8 py-2">
                        {recipe.instructions.map((step, i) => {
                          const stepTime = extractTimeFromStep(step);
                          return (
                            <div key={i} className="relative group">
                              <span className="absolute -left-[45px] top-0 w-9 h-9 rounded-full bg-white dark:bg-gray-800 border-4 border-gray-100 dark:border-gray-700 text-green-600 dark:text-green-400 text-sm font-bold flex items-center justify-center z-10 group-hover:scale-110 transition-transform shadow-sm">
                                {i + 1}
                              </span>
                              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                                {step}
                              </p>
                              {stepTime && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openTimerForStep(step, i + 1, e.clientY);
                                  }}
                                  className="mt-2 text-xs font-semibold text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors tap-scale"
                                >
                                  <Timer size={12} /> Set {stepTime} min timer
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Macros Footer — these are PER SERVING, so they do not move with the
                        servings selector. Cooking 3 servings doesn't change what one serving
                        contains; only the ingredient amounts above scale. */}
                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 text-center">
                        Nutrition per serving
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                         {[
                           { l: 'Cal', v: recipe.nutrition.calories },
                           { l: 'Prot', v: recipe.nutrition.protein },
                           { l: 'Carb', v: recipe.nutrition.carbs },
                           { l: 'Fat', v: recipe.nutrition.fat },
                         ].map((m, idx) => (
                           <div key={idx} className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{m.l}</p>
                             <p className="text-sm font-extrabold text-gray-800 dark:text-white">{m.v || '—'}</p>
                           </div>
                         ))}
                      </div>
                    </div>

                  </div>
                 )}
              </div>
            </div>
          );
        })}
        
        {hasGenerated && (
          <div className="pt-4 pb-8 text-center space-y-4">
            {recipes.length > 0 && !isSearchingDish && (
              <div>
                <button
                  onClick={handleGenerateMore}
                  disabled={loadingMore || loading}
                  className="w-full py-4 rounded-2xl bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold text-sm flex items-center justify-center gap-2 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors tap-scale"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Finding more recipes…
                    </>
                  ) : (
                    <>
                      <Plus size={18} /> Show 3 more recipes
                    </>
                  )}
                </button>
                {waitingMore.message && (
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-2 animate-in fade-in">
                    {waitingMore.message} <span className="font-medium opacity-70">({waitingMore.elapsedSeconds}s)</span>
                  </p>
                )}
              </div>
            )}
            <button
               onClick={() => {
                 setRecipes([]);
                 setHasGenerated(false);
                 setDishSearch("");
                 sessionStorage.removeItem(RECIPE_STATE_KEY);
               }}
               className="text-sm font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
             >
               Clear Results
             </button>
          </div>
        )}
      </div>

      {showTimer && (
        <CookingTimer 
          suggestedMinutes={timerMinutes}
          stepName={timerStepName}
          initialY={timerPosition?.y}
          onClose={() => setShowTimer(false)}
        />
      )}
    </div>
  );
};

export default Recipes;
