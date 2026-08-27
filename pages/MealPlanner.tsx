import React, { useState, useEffect } from 'react';
import { getItems, getMealPlan, saveMealPlan, addToShoppingList, getUserProfile } from '../services/storageService';
import { generateMealPlan } from '../services/geminiService';
import { WeeklyPlan, PantryItem, UserProfile, DayPlan, Meal } from '../types';
import { Calendar, RefreshCw, ShoppingCart, Loader2, ChevronRight, Check, Award, ChefHat } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCookingSkill } from '../contexts/CookingSkillContext';
import { useWaitMessage } from '../hooks/useWaitMessage';

const MealPlanner: React.FC = () => {
  const navigate = useNavigate();
  const { skillLevel, getSkillLabel } = useCookingSkill();
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [items, setItems] = useState<PantryItem[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const waiting = useWaitMessage(loading);
  const [activeDay, setActiveDay] = useState<string>('Monday');
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    setItems(getItems());
    // A plan saved by an older/malformed response could be missing `days` entirely,
    // which used to throw during render and leave this page blank on every visit.
    // Drop anything unusable instead of crashing on it.
    const stored = getMealPlan();
    setPlan(stored && Array.isArray(stored.days) && stored.days.length > 0 ? stored : null);
    setUserProfile(getUserProfile());
  }, []);

  const daysOf = (p: WeeklyPlan | null) => (Array.isArray(p?.days) ? p!.days : []);
  const mealsOf = (day: DayPlan | undefined) => (Array.isArray(day?.meals) ? day!.meals : []);
  const missingOf = (meal: Meal) => (Array.isArray(meal?.missingIngredients) ? meal.missingIngredients : []);

  const handleGenerate = async () => {
    setLoading(true);
    const newPlan = await generateMealPlan(items, userProfile || undefined);
    const days = daysOf(newPlan);
    if (newPlan && days.length > 0) {
      setPlan(newPlan);
      saveMealPlan(newPlan);
      setActiveDay(days[0].day);
      setSynced(false);
    } else if (newPlan) {
      alert("The meal plan came back in an unexpected format. Please try again.");
    }
    setLoading(false);
  };

  // Same hand-off Dashboard and History use: the Chef page picks this up on mount,
  // generates the full recipe for the dish and resolves a cooking video for it.
  const openRecipe = (dishName: string) => {
    sessionStorage.setItem('smart_pantry_quick_search', dishName);
    navigate('/recipes');
  };

  const syncToShoppingList = () => {
    if (!plan) return;
    let count = 0;
    daysOf(plan).forEach(day => {
      mealsOf(day).forEach(meal => {
        missingOf(meal).forEach(ing => {
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
          {waiting.message && (
            <div className="px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 max-w-xs animate-in fade-in">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 leading-relaxed">
                {waiting.message}
              </p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                {waiting.elapsedSeconds}s elapsed — a 7-day plan takes a while.
              </p>
            </div>
          )}
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
            {daysOf(plan).map((d, i) => (
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
            {mealsOf(daysOf(plan).find(d => d.day === activeDay)).map((meal, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-50 dark:border-gray-700">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide">{meal.type}</span>
                    {missingOf(meal).length > 0 && (
                      <span className="text-[10px] text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">
                        Needs {missingOf(meal).length} items
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mt-1">{meal.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{meal.description}</p>
                </div>
                {missingOf(meal).length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/30 px-4 py-3 text-xs">
                    <span className="font-semibold text-gray-500 dark:text-gray-400">Shop for: </span>
                    <span className="text-gray-700 dark:text-gray-300">{missingOf(meal).join(", ")}</span>
                  </div>
                )}
                {/* The plan only names the dish — hand it to the Chef tab, which generates
                    the full method and finds a cooking video for it. */}
                <button
                  onClick={() => openRecipe(meal.title)}
                  className="w-full px-4 py-3 flex items-center justify-between text-sm font-bold text-green-700 dark:text-green-400 bg-green-50/60 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors tap-scale"
                >
                  <span className="flex items-center gap-2">
                    <ChefHat size={16} /> How to make it
                  </span>
                  <ChevronRight size={16} />
                </button>
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