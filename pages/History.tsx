import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecentlyViewed } from '../contexts/RecentlyViewedContext';
import { Clock, ArrowLeft, Utensils, Trash2 } from 'lucide-react';

const History: React.FC = () => {
  const navigate = useNavigate();
  const { recentlyViewed, clearRecentlyViewed } = useRecentlyViewed();

  const handleRecipeClick = (title: string) => {
    sessionStorage.setItem('smart_pantry_quick_search', title);
    navigate('/recipes');
  };

  return (
    <div className="p-4 pb-28 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors tap-scale"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-2xl font-heading font-black text-gray-800 dark:text-white">
            Recently Viewed
          </h1>
        </div>
        {recentlyViewed.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Clear all recently viewed recipes?')) {
                clearRecentlyViewed();
              }
            }}
            className="p-2 rounded-xl bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors tap-scale"
          >
            <Trash2 size={18} className="text-red-500" />
          </button>
        )}
      </div>

      {recentlyViewed.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {recentlyViewed.map((recipe) => (
            <div
              key={recipe.id}
              onClick={() => handleRecipeClick(recipe.title)}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-card overflow-hidden cursor-pointer hover:border-blue-200 dark:hover:border-blue-800 transition-all tap-scale hover:shadow-lg"
            >
              <div className="w-full h-28 relative overflow-hidden">
                {recipe.imageKeyword ? (
                  <img
                    src={`https://image.pollinations.ai/prompt/${encodeURIComponent(recipe.imageKeyword + ' food photography')}?width=300&height=200&nologo=true`}
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
                  <Utensils size={32} className="text-blue-400 dark:text-blue-500" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
              </div>
              <div className="p-3">
                <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm line-clamp-2 leading-tight mb-2">
                  {recipe.title}
                </h4>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Clock size={12} />
                    {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    {new Date(recipe.viewedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
            <Utensils size={36} className="text-blue-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">No recipes viewed yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
            Recipes you open will appear here for quick access
          </p>
          <button
            onClick={() => navigate('/recipes')}
            className="mt-6 px-6 py-3 bg-green-500 text-white font-bold rounded-xl shadow-food hover:bg-green-600 transition-colors tap-scale"
          >
            Browse Recipes
          </button>
        </div>
      )}
    </div>
  );
};

export default History;
