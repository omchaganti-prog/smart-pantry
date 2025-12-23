import React, { useState, useEffect } from 'react';
import { getItems, getMealPlan, saveMealPlan, addToShoppingList, getUserProfile } from '../services/storageService';
import { generateMealPlan } from '../services/geminiService';
import { WeeklyPlan, PantryItem, UserProfile } from '../types';
import { Calendar, RefreshCw, ShoppingCart, Loader2, ChevronRight, Check, Award } from 'lucide-react';
import { useCookingSkill } from '../contexts/CookingSkillContext';

const MealPlanner: React.FC = () => {
  const { skillLevel, getSkillLabel } = useCookingSkill();
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [items, setItems] = useState<PantryItem[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeDay, setActiveDay] = useState<string>('Monday');
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    setItems(getItems());
    setPlan(getMealPlan());
    setUserProfile(getUserProfile());
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    const newPlan = await generateMealPlan(items, userProfile || undefined);
    if (newPlan) {
      setPlan(newPlan);
      saveMealPlan(newPlan);
      setActiveDay(newPlan.days[0].day);
      setSynced(false);
    }
    setLoading(false);
  };

  const syncToShoppingList = () => {
    if (!plan) return;
    let count = 0;
    plan.days.forEach(day => {
      day.meals.forEach(meal => {
        meal.missingIngredients.forEach(ing => {
          addToShoppingList(ing, 'For ' + meal.title);
          count++;
        });
      });
    });
    setSynced(true);
    alert(`Added ${count} items to shopping list!`);
  };

  return (
    <div className="p-4 pb-24 min-h-screen bg-[#f3f4f6] dark:bg-gray-900 transition-colors duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Calendar size={24} /> Meal Planner
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Award size={12} className="text-orange-500" />
            Meals matched to {getSkillLabel()}
          </p>
        </div>
        <button 
          onClick={handleGenerate}
          disabled={loading}
          className="p-2 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
        </button>
      </div>

      {!plan ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mb-2">
            <Calendar size={40} />
          </div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200">No Plan Yet</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-xs text-sm">
            Generate a 7-day meal plan based on your pantry expiration dates and nutrition needs.
          </p>
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium shadow-md w-full max-w-[200px] flex justify-center"
          >
             {loading ? 'Creating Plan...' : 'Create Weekly Plan'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Week Header */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
             <div className="flex justify-between items-center">
               <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Current Plan</span>
               <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">{plan.weekOf}</span>
             </div>
          </div>

          {/* Days Scroller */}
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {plan.days.map((d, i) => (
              <button
                key={i}
                onClick={() => setActiveDay(d.day)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeDay === d.day 
                    ? 'bg-gray-800 dark:bg-green-600 text-white shadow-md' 
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {d.day}
              </button>
            ))}
          </div>

          {/* Meals for Active Day */}
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            {plan.days.find(d => d.day === activeDay)?.meals.map((meal, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-50 dark:border-gray-700">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide">{meal.type}</span>
                    {meal.missingIngredients.length > 0 && (
                      <span className="text-[10px] text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">
                        Needs {meal.missingIngredients.length} items
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mt-1">{meal.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{meal.description}</p>
                </div>
                {meal.missingIngredients.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/30 px-4 py-3 text-xs">
                    <span className="font-semibold text-gray-500 dark:text-gray-400">Shop for: </span>
                    <span className="text-gray-700 dark:text-gray-300">{meal.missingIngredients.join(", ")}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Shopping Action */}
          <div className="sticky bottom-20">
            <button 
              onClick={syncToShoppingList}
              disabled={synced}
              className={`w-full py-4 rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2 transition-all ${
                synced 
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' 
                  : 'bg-indigo-600 dark:bg-green-600 text-white hover:bg-indigo-700 dark:hover:bg-green-700 shadow-indigo-200 dark:shadow-black/50'
              }`}
            >
              {synced ? <Check size={20} /> : <ShoppingCart size={20} />}
              {synced ? 'Ingredients Added' : 'Add Missing to Shopping List'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealPlanner;