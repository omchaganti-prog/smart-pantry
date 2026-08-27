import { Recipe } from '../types';

/**
 * Hand-off for opening one specific, already-generated recipe on the Chef page.
 *
 * Recently Viewed, Favourites and Saved for Later used to reopen a recipe by pushing its
 * title through the dish search, which asked the AI to invent the dish again — so the
 * method, the ingredients and the cooking video all changed between views. Passing the
 * saved recipe itself keeps what you saved exactly as you saved it (and costs no API call).
 *
 * `smart_pantry_quick_search` remains the fallback for entries saved before this existed,
 * and for "cook this dish" prompts where there is no stored recipe yet.
 */

const OPEN_RECIPE_KEY = 'smart_pantry_open_recipe';
const QUICK_SEARCH_KEY = 'smart_pantry_quick_search';

/** Queue a stored recipe to be shown as-is. Falls back to a title search if it can't be stored. */
export const queueRecipeToOpen = (recipe: Recipe): void => {
  try {
    sessionStorage.setItem(OPEN_RECIPE_KEY, JSON.stringify(recipe));
    sessionStorage.removeItem(QUICK_SEARCH_KEY);
  } catch {
    // quota or private mode — regenerating is worse than nothing, but still works
    try {
      sessionStorage.setItem(QUICK_SEARCH_KEY, recipe.title);
    } catch {
      /* nothing more we can do */
    }
  }
};

/** Reads and clears the queued recipe. Returns null when there isn't one. */
export const takeQueuedRecipe = (): Recipe | null => {
  try {
    const raw = sessionStorage.getItem(OPEN_RECIPE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(OPEN_RECIPE_KEY);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.title === 'string' ? (parsed as Recipe) : null;
  } catch {
    return null;
  }
};
