import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getUserProfile, saveUserProfile } from '../services/storageService';
import { Recipe } from '../types';

const ALLERGY_KEYWORD_MAP: Record<string, string[]> = {
  egg: ['egg', 'eggs', 'egg white', 'egg yolk', 'yolk', 'albumin', 'mayonnaise', 'mayo', 'meringue', 'custard', 'aioli', 'hollandaise'],
  milk: ['milk', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt', 'whey', 'casein', 'lactose', 'ghee', 'paneer', 'ricotta', 'mozzarella', 'parmesan', 'cheddar', 'brie', 'feta', 'gouda', 'mascarpone', 'sour cream', 'ice cream', 'half and half', 'condensed milk', 'evaporated milk', 'buttermilk', 'kefir', 'cottage cheese', 'cream cheese'],
  dairy: ['milk', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt', 'whey', 'casein', 'lactose', 'ghee', 'paneer', 'ricotta', 'mozzarella', 'parmesan', 'cheddar', 'brie', 'feta', 'gouda', 'mascarpone', 'sour cream', 'ice cream', 'half and half', 'condensed milk', 'evaporated milk', 'buttermilk', 'kefir', 'cottage cheese', 'cream cheese'],
  nut: ['nut', 'nuts', 'peanut', 'peanuts', 'almond', 'almonds', 'cashew', 'cashews', 'walnut', 'walnuts', 'pecan', 'pecans', 'pistachio', 'pistachios', 'hazelnut', 'hazelnuts', 'macadamia', 'brazil nut', 'pine nut', 'pine nuts', 'chestnut', 'chestnuts', 'praline', 'marzipan', 'nougat', 'nutella', 'almond flour', 'almond milk', 'cashew milk', 'nut butter', 'peanut butter', 'almond butter'],
  peanut: ['peanut', 'peanuts', 'peanut butter', 'peanut oil', 'groundnut', 'arachis oil'],
  treenut: ['almond', 'almonds', 'cashew', 'cashews', 'walnut', 'walnuts', 'pecan', 'pecans', 'pistachio', 'pistachios', 'hazelnut', 'hazelnuts', 'macadamia', 'brazil nut', 'pine nut', 'pine nuts', 'chestnut', 'chestnuts', 'praline', 'marzipan'],
  gluten: ['gluten', 'wheat', 'flour', 'bread', 'pasta', 'noodle', 'noodles', 'spaghetti', 'macaroni', 'fettuccine', 'lasagna', 'ramen', 'udon', 'couscous', 'bulgur', 'semolina', 'durum', 'spelt', 'barley', 'rye', 'malt', 'seitan', 'crouton', 'croutons', 'breadcrumb', 'breadcrumbs', 'panko', 'tortilla', 'pita', 'naan', 'bagel', 'croissant', 'pastry', 'cake', 'cookie', 'biscuit', 'cracker', 'pretzel', 'beer', 'soy sauce', 'teriyaki'],
  wheat: ['wheat', 'flour', 'bread', 'pasta', 'noodle', 'noodles', 'spaghetti', 'macaroni', 'fettuccine', 'lasagna', 'couscous', 'bulgur', 'semolina', 'durum', 'spelt', 'seitan', 'crouton', 'croutons', 'breadcrumb', 'breadcrumbs', 'panko', 'tortilla', 'pita', 'naan', 'bagel', 'croissant', 'pastry', 'cake', 'cookie', 'biscuit', 'cracker', 'pretzel'],
  soy: ['soy', 'soya', 'soybean', 'soybeans', 'tofu', 'tempeh', 'edamame', 'miso', 'soy sauce', 'soy milk', 'soy protein', 'soy lecithin', 'tamari', 'teriyaki', 'hoisin'],
  fish: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'trout', 'bass', 'mackerel', 'sardine', 'sardines', 'anchovy', 'anchovies', 'catfish', 'flounder', 'haddock', 'herring', 'perch', 'snapper', 'sole', 'swordfish', 'fish sauce', 'worcestershire', 'caesar dressing'],
  shellfish: ['shellfish', 'shrimp', 'prawns', 'crab', 'lobster', 'crayfish', 'crawfish', 'scallop', 'scallops', 'mussel', 'mussels', 'clam', 'clams', 'oyster', 'oysters', 'squid', 'calamari', 'octopus', 'abalone'],
  seafood: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'trout', 'bass', 'mackerel', 'sardine', 'sardines', 'anchovy', 'anchovies', 'shrimp', 'prawns', 'crab', 'lobster', 'crayfish', 'crawfish', 'scallop', 'scallops', 'mussel', 'mussels', 'clam', 'clams', 'oyster', 'oysters', 'squid', 'calamari', 'octopus'],
  sesame: ['sesame', 'sesame seed', 'sesame seeds', 'tahini', 'hummus', 'sesame oil', 'halvah', 'halva'],
  mustard: ['mustard', 'mustard seed', 'mustard seeds', 'dijon', 'honey mustard'],
  celery: ['celery', 'celery salt', 'celery seed', 'celeriac'],
  lupin: ['lupin', 'lupini', 'lupine'],
  mollusc: ['mussel', 'mussels', 'clam', 'clams', 'oyster', 'oysters', 'squid', 'calamari', 'octopus', 'snail', 'escargot', 'abalone', 'scallop', 'scallops'],
  sulfite: ['sulfite', 'sulphite', 'sulfites', 'sulphites', 'wine', 'dried fruit'],
  onion: ['onion', 'onions', 'shallot', 'shallots', 'scallion', 'scallions', 'leek', 'leeks', 'chive', 'chives', 'spring onion'],
  garlic: ['garlic', 'garlic powder', 'garlic salt', 'minced garlic'],
  corn: ['corn', 'maize', 'cornmeal', 'cornstarch', 'corn flour', 'corn syrup', 'polenta', 'grits', 'hominy', 'popcorn', 'corn oil', 'tortilla'],
  tomato: ['tomato', 'tomatoes', 'tomato sauce', 'tomato paste', 'marinara', 'ketchup', 'salsa', 'sun-dried tomato'],
  citrus: ['lemon', 'lime', 'orange', 'grapefruit', 'tangerine', 'clementine', 'mandarin', 'citrus', 'lemon juice', 'lime juice', 'orange juice', 'zest'],
  avocado: ['avocado', 'guacamole'],
  banana: ['banana', 'plantain'],
  strawberry: ['strawberry', 'strawberries'],
  kiwi: ['kiwi', 'kiwifruit'],
  mango: ['mango', 'mangoes'],
  papaya: ['papaya'],
  pineapple: ['pineapple'],
  coconut: ['coconut', 'coconut milk', 'coconut cream', 'coconut oil', 'coconut flour', 'coconut water', 'desiccated coconut'],
  chicken: ['chicken', 'poultry', 'chicken breast', 'chicken thigh', 'chicken wing', 'rotisserie chicken'],
  beef: ['beef', 'steak', 'ground beef', 'brisket', 'ribeye', 'sirloin', 'tenderloin', 'roast beef', 'veal'],
  pork: ['pork', 'bacon', 'ham', 'sausage', 'prosciutto', 'pancetta', 'chorizo', 'pork chop', 'pork loin', 'pulled pork'],
  lamb: ['lamb', 'mutton', 'lamb chop', 'leg of lamb'],
  alcohol: ['wine', 'beer', 'vodka', 'rum', 'whiskey', 'bourbon', 'brandy', 'liqueur', 'sake', 'mirin', 'cooking wine', 'sherry'],
};

const normalizeText = (text: string): string => {
  return text.toLowerCase().trim()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/\s+/g, ' ');
};

const singularize = (word: string): string => {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('es') && !word.endsWith('oes') && !word.endsWith('ses')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
};

interface AllergyContextType {
  allergies: string[];
  addAllergy: (allergy: string) => void;
  removeAllergy: (allergy: string) => void;
  clearAllergies: () => void;
  containsAllergen: (ingredient: string) => string | null;
  filterRecipesByAllergy: (recipes: Recipe[]) => Recipe[];
  getExcludedRecipesInfo: (recipes: Recipe[]) => { recipe: Recipe; allergen: string }[];
}

const AllergyContext = createContext<AllergyContextType | undefined>(undefined);

export const AllergyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [allergies, setAllergies] = useState<string[]>([]);

  useEffect(() => {
    const profile = getUserProfile();
    if (profile?.allergies) {
      setAllergies(profile.allergies.map(a => normalizeText(a)));
    }
  }, []);

  const saveAllergies = (newAllergies: string[]) => {
    const profile = getUserProfile();
    if (profile) {
      const updated = { ...profile, allergies: newAllergies, updatedAt: new Date().toISOString() };
      saveUserProfile(updated);
    }
  };

  const addAllergy = useCallback((allergy: string) => {
    const normalized = normalizeText(allergy);
    if (!normalized || allergies.includes(normalized)) return;
    const newAllergies = [...allergies, normalized];
    setAllergies(newAllergies);
    saveAllergies(newAllergies);
  }, [allergies]);

  const removeAllergy = useCallback((allergy: string) => {
    const normalized = normalizeText(allergy);
    const newAllergies = allergies.filter(a => a !== normalized);
    setAllergies(newAllergies);
    saveAllergies(newAllergies);
  }, [allergies]);

  const clearAllergies = useCallback(() => {
    setAllergies([]);
    saveAllergies([]);
  }, []);

  const containsAllergen = useCallback((ingredient: string): string | null => {
    const normalizedIngredient = normalizeText(ingredient);
    const ingredientWords = normalizedIngredient.split(/[\s,\-\/\(\)]+/).map(singularize);
    
    for (const allergy of allergies) {
      const allergyLower = allergy.toLowerCase();
      const singularAllergy = singularize(allergyLower);
      
      const relatedKeywords = ALLERGY_KEYWORD_MAP[singularAllergy] || 
                              ALLERGY_KEYWORD_MAP[allergyLower] || 
                              [allergyLower, singularAllergy];
      
      for (const keyword of relatedKeywords) {
        const normalizedKeyword = normalizeText(keyword);
        const singularKeyword = singularize(normalizedKeyword);
        
        if (normalizedIngredient.includes(normalizedKeyword)) {
          return allergy;
        }
        if (normalizedIngredient.includes(singularKeyword)) {
          return allergy;
        }
        if (ingredientWords.includes(singularKeyword)) {
          return allergy;
        }
      }
      
      if (normalizedIngredient.includes(singularAllergy)) {
        return allergy;
      }
      if (ingredientWords.includes(singularAllergy)) {
        return allergy;
      }
    }
    
    return null;
  }, [allergies]);

  const filterRecipesByAllergy = useCallback((recipes: Recipe[]): Recipe[] => {
    if (allergies.length === 0) return recipes;
    
    return recipes.filter(recipe => {
      const items = recipe.ingredientSections?.flatMap(s => s.items) || recipe.ingredients || [];
      for (const ingredient of items) {
        const allergen = containsAllergen(ingredient.name);
        if (allergen) return false;
      }
      
      const titleAllergen = containsAllergen(recipe.title);
      if (titleAllergen) return false;
      
      const descAllergen = containsAllergen(recipe.description);
      if (descAllergen) return false;
      
      return true;
    });
  }, [allergies, containsAllergen]);

  const getExcludedRecipesInfo = useCallback((recipes: Recipe[]): { recipe: Recipe; allergen: string }[] => {
    if (allergies.length === 0) return [];
    
    const excluded: { recipe: Recipe; allergen: string }[] = [];
    
    for (const recipe of recipes) {
      let foundAllergen: string | null = null;
      const items = recipe.ingredientSections?.flatMap(s => s.items) || recipe.ingredients || [];

      for (const ingredient of items) {
        foundAllergen = containsAllergen(ingredient.name);
        if (foundAllergen) break;
      }
      
      if (!foundAllergen) {
        foundAllergen = containsAllergen(recipe.title);
      }
      
      if (!foundAllergen) {
        foundAllergen = containsAllergen(recipe.description);
      }
      
      if (foundAllergen) {
        excluded.push({ recipe, allergen: foundAllergen });
      }
    }
    
    return excluded;
  }, [allergies, containsAllergen]);

  return (
    <AllergyContext.Provider value={{
      allergies,
      addAllergy,
      removeAllergy,
      clearAllergies,
      containsAllergen,
      filterRecipesByAllergy,
      getExcludedRecipesInfo
    }}>
      {children}
    </AllergyContext.Provider>
  );
};

export const useAllergy = () => {
  const context = useContext(AllergyContext);
  if (!context) {
    throw new Error('useAllergy must be used within an AllergyProvider');
  }
  return context;
};
