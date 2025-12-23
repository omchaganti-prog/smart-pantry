import React, { useEffect, useState } from 'react';
import { PantryItem, FoodCategory, UserProfile } from '../types';
import { getItems, getUserProfile } from '../services/storageService';
import { AlertTriangle, ChevronRight, ScanLine, Utensils, Calendar, ShoppingCart, Leaf, Clock, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRecentlyViewed } from '../contexts/RecentlyViewedContext';

const Dashboard: React.FC = () => {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const navigate = useNavigate();
  const { recentlyViewed } = useRecentlyViewed();

  useEffect(() => {
    setItems(getItems());
    setProfile(getUserProfile());
  }, []);

  // Stats
  const expiringSoon = items.filter(item => {
    if (!item.expiryDate) return false;
    const diff = new Date(item.expiryDate).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    return days >= 0 && days <= 5;
  }).sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime());

  const quickActions = [
    { icon: <ScanLine size={24} />, label: "Scan", path: "/scan", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" },
    { icon: <Utensils size={24} />, label: "Cook", path: "/recipes", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" },
    { icon: <ShoppingCart size={24} />, label: "Shop", path: "/shopping", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
    { icon: <Calendar size={24} />, label: "Plan", path: "/planner", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400" },
  ];

  return (
    <div className="p-6 pb-28 min-h-screen space-y-8 transition-colors duration-300">
      {/* Header */}
      <header className="flex justify-between items-center animate-fade-in">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-800 dark:text-white tracking-tight">
            SmartPantry <span className="text-green-500">.</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium text-[15px]">
            Good Morning, {profile?.nickname || profile?.name.split(' ')[0] || 'Chef'}!
          </p>
        </div>
        <div 
          onClick={() => navigate('/profile')}
          className="w-11 h-11 rounded-full bg-gradient-to-br from-green-50 to-orange-50 dark:from-gray-800 dark:to-gray-700 border-2 border-white dark:border-gray-600 shadow-card flex items-center justify-center text-xl cursor-pointer hover:scale-105 transition-transform tap-scale"
        >
          {profile?.avatar || '👨‍🍳'}
        </div>
      </header>

      {/* Hero Card */}
      <div 
        onClick={() => navigate('/recipes')}
        className="relative overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-800 dark:to-black rounded-3xl p-6 shadow-card text-white cursor-pointer tap-scale border border-transparent dark:border-gray-700 animate-fade-in-up opacity-0"
        style={{ animationDelay: '0.1s' }}
      >
        <div className="relative z-10">
          <div className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold mb-3 border border-white/10">
            Suggested for you
          </div>
          <h2 className="text-2xl font-bold leading-tight mb-2 text-white">What's cooking <br/> tonight?</h2>
          <div className="flex items-center gap-2 text-gray-300 text-sm">
             <span>Based on {items.length} items</span>
             <ChevronRight size={16} />
          </div>
        </div>
        
        {/* Decorative Background Elements */}
        <div className="absolute right-[-20px] bottom-[-20px] opacity-20 transform rotate-12 text-white">
           <Utensils size={120} />
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20"></div>
      </div>

      {/* Quick Actions */}
      <div className="animate-fade-in-up opacity-0" style={{ animationDelay: '0.15s' }}>
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 px-1">Quick Actions</h3>
        <div className="grid grid-cols-4 gap-4">
          {quickActions.map((action, idx) => (
            <button 
              key={idx}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center gap-2 group tap-scale"
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-food transition-all duration-150 group-hover:scale-105 ${action.color}`}>
                {action.icon}
              </div>
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recently Viewed Recipes */}
      <div className="animate-fade-in-up opacity-0" style={{ animationDelay: '0.18s' }}>
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <History size={18} className="text-blue-500" />
            Recently Viewed
          </h3>
          {recentlyViewed.length > 0 && (
            <span 
              onClick={() => navigate('/history')} 
              className="text-xs font-bold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline tap-scale"
            >
              View all
            </span>
          )}
        </div>
        
        {recentlyViewed.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
            {recentlyViewed.map((recipe, i) => (
              <div 
                key={recipe.id}
                onClick={() => {
                  sessionStorage.setItem('smart_pantry_quick_search', recipe.title);
                  navigate('/recipes');
                }}
                className="flex-shrink-0 w-32 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-card overflow-hidden tap-scale cursor-pointer hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
              >
                <div className="w-full h-20 relative overflow-hidden">
                  {recipe.imageKeyword ? (
                    <img 
                      src={`https://image.pollinations.ai/prompt/${encodeURIComponent(recipe.imageKeyword + ' food photography')}?width=200&height=150&nologo=true`}
                      alt={recipe.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/20 flex items-center justify-center ${recipe.imageKeyword ? 'hidden' : ''}`}>
                    <Utensils size={28} className="text-blue-400 dark:text-blue-500" />
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="font-bold text-gray-800 dark:text-gray-100 text-xs line-clamp-2 leading-tight mb-1">
                    {recipe.title}
                  </h4>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Clock size={10} />
                    {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10 rounded-2xl p-6 text-center border border-blue-100 dark:border-blue-800/30">
            <Utensils className="mx-auto text-blue-400 mb-2" size={32} />
            <p className="text-blue-800 dark:text-blue-300 font-bold">You haven't viewed any recipes yet.</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Open a recipe to see it here!</p>
          </div>
        )}
      </div>

      {/* Expiring Soon Horizontal Scroll */}
      <div className="animate-fade-in-up opacity-0" style={{ animationDelay: '0.2s' }}>
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Eat Me First</h3>
          <span 
            onClick={() => navigate('/pantry')} 
            className="text-xs font-bold text-green-600 dark:text-green-400 cursor-pointer hover:underline tap-scale"
          >
            See all
          </span>
        </div>
        
        {expiringSoon.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
            {expiringSoon.map((item, i) => (
              <div 
                key={item.id}
                onClick={() => navigate('/pantry')}
                className="flex-shrink-0 w-36 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-card relative overflow-hidden tap-scale cursor-pointer hover:border-orange-200 dark:hover:border-orange-800 transition-colors"
              >
                <div className="absolute top-3 right-3">
                   <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse-soft"></div>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/20 rounded-xl flex items-center justify-center text-2xl mb-3">
                   {item.category === FoodCategory.PRODUCE ? '🥬' : item.category === FoodCategory.DAIRY ? '🥛' : '🥫'}
                </div>
                <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate leading-tight">{item.name}</h4>
                <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold mt-1.5">
                  Exp: {item.expiryDate?.slice(5)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 rounded-2xl p-6 text-center border border-green-100 dark:border-green-800/30">
             <Leaf className="mx-auto text-green-500 mb-2" size={32} />
             <p className="text-green-800 dark:text-green-300 font-bold">Your pantry is fresh!</p>
             <p className="text-xs text-green-600 dark:text-green-400 mt-1">No expiring items found.</p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 animate-fade-in-up opacity-0" style={{ animationDelay: '0.25s' }}>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-card border border-gray-100 dark:border-gray-700 hover:border-green-200 dark:hover:border-green-800 transition-colors">
           <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-1">Total Items</p>
           <p className="text-3xl font-extrabold text-gray-800 dark:text-white">{items.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-card border border-gray-100 dark:border-gray-700 hover:border-green-200 dark:hover:border-green-800 transition-colors">
           <p className="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-1">Categories</p>
           <p className="text-3xl font-extrabold text-gray-800 dark:text-white">{new Set(items.map(i => i.category)).size}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;