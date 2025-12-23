import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Recipe } from '../types';

const RECENTLY_VIEWED_KEY = 'smartpantry_recently_viewed';
const MAX_RECENTLY_VIEWED = 8;

interface RecentlyViewedRecipe {
  id: string;
  title: string;
  imageKeyword?: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  viewedAt: number;
}

interface RecentlyViewedContextType {
  recentlyViewed: RecentlyViewedRecipe[];
  addToRecentlyViewed: (recipe: Recipe) => void;
  clearRecentlyViewed: () => void;
  removeFromRecentlyViewed: (recipeId: string) => void;
}

const RecentlyViewedContext = createContext<RecentlyViewedContextType | undefined>(undefined);

export const RecentlyViewedProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedRecipe[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recentlyViewed));
      } catch (e) {
        console.error('Failed to save recently viewed:', e);
      }
    }
  }, [recentlyViewed]);

  const addToRecentlyViewed = useCallback((recipe: Recipe) => {
    setRecentlyViewed(prev => {
      const filtered = prev.filter(r => r.id !== recipe.id);
      
      const newEntry: RecentlyViewedRecipe = {
        id: recipe.id,
        title: recipe.title,
        imageKeyword: recipe.imageKeyword,
        prepTimeMinutes: recipe.prepTimeMinutes,
        cookTimeMinutes: recipe.cookTimeMinutes,
        viewedAt: Date.now()
      };
      
      const updated = [newEntry, ...filtered].slice(0, MAX_RECENTLY_VIEWED);
      return updated;
    });
  }, []);

  const removeFromRecentlyViewed = useCallback((recipeId: string) => {
    setRecentlyViewed(prev => prev.filter(r => r.id !== recipeId));
  }, []);

  const clearRecentlyViewed = useCallback(() => {
    setRecentlyViewed([]);
  }, []);

  return (
    <RecentlyViewedContext.Provider value={{
      recentlyViewed,
      addToRecentlyViewed,
      clearRecentlyViewed,
      removeFromRecentlyViewed
    }}>
      {children}
    </RecentlyViewedContext.Provider>
  );
};

export const useRecentlyViewed = () => {
  const context = useContext(RecentlyViewedContext);
  if (context === undefined) {
    throw new Error('useRecentlyViewed must be used within a RecentlyViewedProvider');
  }
  return context;
};
