import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SkillLevel, Recipe } from '../types';

type RecipeDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

const SKILL_TO_DIFFICULTIES: Record<SkillLevel, RecipeDifficulty[]> = {
  [SkillLevel.BEGINNER]: ['Easy'],
  [SkillLevel.INTERMEDIATE]: ['Easy', 'Medium'],
  [SkillLevel.EXPERT]: ['Medium', 'Hard'],
  [SkillLevel.PROFESSIONAL]: ['Easy', 'Medium', 'Hard', 'Expert'],
};

const SKILL_LABELS: Record<SkillLevel, string> = {
  [SkillLevel.BEGINNER]: 'Beginner skill level',
  [SkillLevel.INTERMEDIATE]: 'Intermediate skill level',
  [SkillLevel.EXPERT]: 'Expert skill level',
  [SkillLevel.PROFESSIONAL]: 'All skill levels',
};

interface CookingSkillContextType {
  skillLevel: SkillLevel;
  setSkillLevel: (level: SkillLevel) => void;
  filterRecipes: <T extends { difficulty?: RecipeDifficulty }>(recipes: T[]) => T[];
  getAllowedDifficulties: () => RecipeDifficulty[];
  getSkillLabel: () => string;
  isRecipeAllowed: (difficulty?: RecipeDifficulty) => boolean;
}

const CookingSkillContext = createContext<CookingSkillContextType | undefined>(undefined);

const STORAGE_KEY = 'smartpantry_cooking_skill';

const getInitialSkillLevel = (): SkillLevel => {
  if (typeof window === 'undefined') return SkillLevel.INTERMEDIATE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && Object.values(SkillLevel).includes(stored as SkillLevel)) {
      return stored as SkillLevel;
    }
  } catch {}
  return SkillLevel.INTERMEDIATE;
};

export const CookingSkillProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [skillLevel, setSkillLevelState] = useState<SkillLevel>(getInitialSkillLevel);

  const setSkillLevel = (level: SkillLevel) => {
    setSkillLevelState(level);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, level); } catch {}
    }
  };

  const getAllowedDifficulties = (): RecipeDifficulty[] => {
    return SKILL_TO_DIFFICULTIES[skillLevel];
  };

  const isRecipeAllowed = (difficulty?: RecipeDifficulty): boolean => {
    const normalizedDifficulty: RecipeDifficulty = difficulty || 'Medium';
    return getAllowedDifficulties().includes(normalizedDifficulty);
  };

  const filterRecipes = <T extends { difficulty?: RecipeDifficulty }>(recipes: T[]): T[] => {
    const allowed = getAllowedDifficulties();
    return recipes.filter(recipe => {
      const difficulty: RecipeDifficulty = recipe.difficulty || 'Medium';
      return allowed.includes(difficulty);
    });
  };

  const getSkillLabel = (): string => {
    return SKILL_LABELS[skillLevel];
  };

  return (
    <CookingSkillContext.Provider
      value={{
        skillLevel,
        setSkillLevel,
        filterRecipes,
        getAllowedDifficulties,
        getSkillLabel,
        isRecipeAllowed,
      }}
    >
      {children}
    </CookingSkillContext.Provider>
  );
};

export const useCookingSkill = () => {
  const context = useContext(CookingSkillContext);
  if (context === undefined) {
    throw new Error('useCookingSkill must be used within a CookingSkillProvider');
  }
  return context;
};

export { SKILL_TO_DIFFICULTIES, SKILL_LABELS };
