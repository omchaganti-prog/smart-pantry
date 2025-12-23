import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';

type SpiceLevel = 'mild' | 'medium' | 'spicy' | 'fiery';

interface SpiceRange {
  min: number;
  max: number;
  level: SpiceLevel;
  label: string;
}

const SPICE_RANGES: SpiceRange[] = [
  { min: 0, max: 25, level: 'mild', label: 'Mild' },
  { min: 26, max: 50, level: 'medium', label: 'Medium' },
  { min: 51, max: 75, level: 'spicy', label: 'Spicy' },
  { min: 76, max: 100, level: 'fiery', label: 'Fiery' },
];

const SPICE_LEVEL_ORDER: Record<SpiceLevel, number> = {
  mild: 1,
  medium: 2,
  spicy: 3,
  fiery: 4,
};

const getSpiceLevelFromValue = (value: number): SpiceLevel => {
  for (const range of SPICE_RANGES) {
    if (value >= range.min && value <= range.max) {
      return range.level;
    }
  }
  return 'medium';
};

const getSpiceLabelFromValue = (value: number): string => {
  for (const range of SPICE_RANGES) {
    if (value >= range.min && value <= range.max) {
      return range.label;
    }
  }
  return 'Medium';
};

interface SpiceToleranceContextType {
  spiceTolerance: number;
  setSpiceTolerance: (value: number) => void;
  currentSpiceLevel: SpiceLevel;
  currentSpiceLabel: string;
  filterRecipesBySpice: <T extends { spiciness?: number; spiceLevel?: SpiceLevel }>(recipes: T[]) => T[];
  isSpiceAllowed: (spiciness?: number, spiceLevel?: SpiceLevel) => boolean;
}

const SpiceToleranceContext = createContext<SpiceToleranceContextType | undefined>(undefined);

const STORAGE_KEY = 'smartpantry_spice_tolerance';

const getInitialSpiceTolerance = (): number => {
  if (typeof window === 'undefined') return 50;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      const value = parseInt(stored, 10);
      if (!isNaN(value) && value >= 0 && value <= 100) {
        return value;
      }
    }
  } catch {}
  return 50;
};

export const SpiceToleranceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [spiceTolerance, setSpiceToleranceState] = useState<number>(getInitialSpiceTolerance);

  const setSpiceTolerance = (value: number) => {
    const clampedValue = Math.max(0, Math.min(100, value));
    setSpiceToleranceState(clampedValue);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, String(clampedValue)); } catch {}
    }
  };

  const currentSpiceLevel = useMemo(() => getSpiceLevelFromValue(spiceTolerance), [spiceTolerance]);
  const currentSpiceLabel = useMemo(() => getSpiceLabelFromValue(spiceTolerance), [spiceTolerance]);

  const isSpiceAllowed = (spiciness?: number, spiceLevel?: SpiceLevel): boolean => {
    let recipeLevel: SpiceLevel;
    
    if (spiceLevel) {
      recipeLevel = spiceLevel;
    } else if (spiciness !== undefined && spiciness !== null) {
      if (spiciness <= 1) recipeLevel = 'mild';
      else if (spiciness <= 2) recipeLevel = 'medium';
      else if (spiciness <= 3) recipeLevel = 'spicy';
      else recipeLevel = 'fiery';
    } else {
      recipeLevel = 'medium';
    }
    
    const recipeOrder = SPICE_LEVEL_ORDER[recipeLevel];
    const toleranceOrder = SPICE_LEVEL_ORDER[currentSpiceLevel];
    
    return recipeOrder <= toleranceOrder;
  };

  const filterRecipesBySpice = <T extends { spiciness?: number; spiceLevel?: SpiceLevel }>(recipes: T[]): T[] => {
    return recipes.filter(recipe => isSpiceAllowed(recipe.spiciness, recipe.spiceLevel));
  };

  return (
    <SpiceToleranceContext.Provider
      value={{
        spiceTolerance,
        setSpiceTolerance,
        currentSpiceLevel,
        currentSpiceLabel,
        filterRecipesBySpice,
        isSpiceAllowed,
      }}
    >
      {children}
    </SpiceToleranceContext.Provider>
  );
};

export const useSpiceTolerance = () => {
  const context = useContext(SpiceToleranceContext);
  if (context === undefined) {
    throw new Error('useSpiceTolerance must be used within a SpiceToleranceProvider');
  }
  return context;
};

export { SPICE_RANGES, SPICE_LEVEL_ORDER, getSpiceLevelFromValue, getSpiceLabelFromValue };
export type { SpiceLevel };
