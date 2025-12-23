import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { Recipe } from '../types';

const FAVORITES_KEY = 'smart_pantry_favorites';
const SAVED_KEY = 'smart_pantry_saved_for_later';
const RECIPES_CACHE_KEY = 'smart_pantry_recipes_cache';

interface FavoritesContextType {
  favorites: Set<string>;
  savedForLater: Set<string>;
  recipesCache: Map<string, Recipe>;
  addFavorite: (recipeId: string, recipe?: Recipe) => void;
  removeFavorite: (recipeId: string) => void;
  toggleFavorite: (recipeId: string, recipe?: Recipe) => void;
  isFavorite: (recipeId: string) => boolean;
  addSavedForLater: (recipeId: string, recipe?: Recipe) => void;
  removeSavedForLater: (recipeId: string) => void;
  toggleSavedForLater: (recipeId: string, recipe?: Recipe) => void;
  isSavedForLater: (recipeId: string) => boolean;
  getFavoriteRecipes: () => Recipe[];
  getSavedForLaterRecipes: () => Recipe[];
  cacheRecipe: (recipeId: string, recipe: Recipe) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const [savedForLater, setSavedForLater] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(SAVED_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const [recipesCache, setRecipesCache] = useState<Map<string, Recipe>>(() => {
    try {
      const stored = localStorage.getItem(RECIPES_CACHE_KEY);
      return stored ? new Map(Object.entries(JSON.parse(stored))) : new Map();
    } catch { return new Map(); }
  });

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
    } catch {}
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify([...savedForLater]));
    } catch {}
  }, [savedForLater]);

  useEffect(() => {
    try {
      const cacheObj: Record<string, Recipe> = {};
      recipesCache.forEach((recipe, id) => { cacheObj[id] = recipe; });
      localStorage.setItem(RECIPES_CACHE_KEY, JSON.stringify(cacheObj));
    } catch {}
  }, [recipesCache]);

  const cacheRecipe = useCallback((recipeId: string, recipe: Recipe) => {
    const recipeWithId = { ...recipe, id: recipeId };
    setRecipesCache(prev => {
      const newCache = new Map(prev);
      newCache.set(recipeId, recipeWithId);
      return newCache;
    });
  }, []);

  const addFavorite = useCallback((recipeId: string, recipe?: Recipe) => {
    if (!recipe) {
      console.warn('addFavorite called without recipe data - recipe may not persist');
      return;
    }
    cacheRecipe(recipeId, recipe);
    setFavorites(prev => new Set(prev).add(recipeId));
  }, [cacheRecipe]);

  const removeFavorite = useCallback((recipeId: string) => {
    setFavorites(prev => {
      const newSet = new Set(prev);
      newSet.delete(recipeId);
      return newSet;
    });
  }, []);

  const toggleFavorite = useCallback((recipeId: string, recipe?: Recipe) => {
    if (favorites.has(recipeId)) {
      removeFavorite(recipeId);
    } else {
      addFavorite(recipeId, recipe);
    }
  }, [favorites, addFavorite, removeFavorite]);

  const isFavorite = useCallback((recipeId: string) => favorites.has(recipeId), [favorites]);

  const addSavedForLater = useCallback((recipeId: string, recipe?: Recipe) => {
    if (!recipe) {
      console.warn('addSavedForLater called without recipe data - recipe may not persist');
      return;
    }
    cacheRecipe(recipeId, recipe);
    setSavedForLater(prev => new Set(prev).add(recipeId));
  }, [cacheRecipe]);

  const removeSavedForLater = useCallback((recipeId: string) => {
    setSavedForLater(prev => {
      const newSet = new Set(prev);
      newSet.delete(recipeId);
      return newSet;
    });
  }, []);

  const toggleSavedForLater = useCallback((recipeId: string, recipe?: Recipe) => {
    if (savedForLater.has(recipeId)) {
      removeSavedForLater(recipeId);
    } else {
      addSavedForLater(recipeId, recipe);
    }
  }, [savedForLater, addSavedForLater, removeSavedForLater]);

  const isSavedForLater = useCallback((recipeId: string) => savedForLater.has(recipeId), [savedForLater]);

  const getFavoriteRecipes = useCallback((): Recipe[] => {
    const recipes: Recipe[] = [];
    favorites.forEach(id => {
      const recipe = recipesCache.get(id);
      if (recipe) recipes.push(recipe);
    });
    return recipes;
  }, [favorites, recipesCache]);

  const getSavedForLaterRecipes = useCallback((): Recipe[] => {
    const recipes: Recipe[] = [];
    savedForLater.forEach(id => {
      const recipe = recipesCache.get(id);
      if (recipe) recipes.push(recipe);
    });
    return recipes;
  }, [savedForLater, recipesCache]);

  return (
    <FavoritesContext.Provider value={{
      favorites,
      savedForLater,
      recipesCache,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      isFavorite,
      addSavedForLater,
      removeSavedForLater,
      toggleSavedForLater,
      isSavedForLater,
      getFavoriteRecipes,
      getSavedForLaterRecipes,
      cacheRecipe
    }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = (): FavoritesContextType => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};
