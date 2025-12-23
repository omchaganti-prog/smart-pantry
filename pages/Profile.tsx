import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserProfile, saveUserProfile } from '../services/storageService';
import { UserProfile, Recipe } from '../types';
import { Edit2, Check, Save, X, Utensils, Heart, AlertTriangle, Bookmark, Clock, ChevronRight, Trash2 } from 'lucide-react';
import { useFavorites } from '../contexts/FavoritesContext';
import { useUndo } from '../contexts/UndoContext';

const AVATARS = [
  '👨‍🍳', '👩‍🍳', '🥑', '🍕', '🍔', '🥗', 
  '🍱', '🍲', '🍎', '🥦', '🥕', '🍓',
  '🧙‍♂️', '🦸‍♀️', '🦁', '🐱', '🐼', '🦊'
];

const DIETS = ['Vegetarian', 'Vegan', 'Keto', 'Gluten-Free', 'Paleo', 'Halal'];
const ALLERGIES = ['Peanuts', 'Dairy', 'Eggs', 'Soy', 'Shellfish', 'Wheat'];

const RecipeCard: React.FC<{ recipe: Recipe; onRemove: () => void; isFavorite?: boolean }> = ({ recipe, onRemove, isFavorite }) => {
  const navigate = useNavigate();
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 flex items-center gap-4 group hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 flex items-center justify-center text-2xl flex-shrink-0">
        {isFavorite ? '❤️' : '📌'}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-gray-800 dark:text-white text-sm truncate">{recipe.title}</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
          <Clock size={12} />
          {(recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0)} min
          <span className="text-gray-300 dark:text-gray-600">•</span>
          {recipe.nutrition?.calories || '—'} cal
        </p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        title="Remove"
      >
        <Trash2 size={18} />
      </button>
      <button
        onClick={() => {
          sessionStorage.setItem('smart_pantry_quick_search', recipe.title);
          navigate('/recipes');
        }}
        className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
};

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { getFavoriteRecipes, getSavedForLaterRecipes, removeFavorite, removeSavedForLater, addFavorite, addSavedForLater, favorites, savedForLater } = useFavorites();
  const { showUndo } = useUndo();
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState<UserProfile | null>(null);
  const [showAllFavorites, setShowAllFavorites] = useState(false);
  const [showAllSaved, setShowAllSaved] = useState(false);

  const favoriteRecipes = getFavoriteRecipes();
  const savedRecipes = getSavedForLaterRecipes();

  useEffect(() => {
    const data = getUserProfile();
    setProfile(data);
    setEditForm(data);
  }, []);

  const handleSave = () => {
    if (editForm) {
      saveUserProfile(editForm);
      setProfile(editForm);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditForm(profile);
    setIsEditing(false);
  };

  const toggleList = (list: string[], item: string): string[] => {
    return list.includes(item) 
      ? list.filter(i => i !== item)
      : [...list, item];
  };

  if (!profile || !editForm) return null;

  return (
    <div className="p-4 pb-28 min-h-screen bg-[#FAFAF9] dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 animate-fade-in">
        <h1 className="text-3xl font-extrabold text-gray-800 dark:text-white">My Profile</h1>
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="p-2.5 bg-white dark:bg-gray-800 rounded-xl shadow-card border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-all tap-scale"
          >
            <Edit2 size={20} />
          </button>
        )}
      </div>

      {/* Main Card */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-card border border-gray-100 dark:border-gray-700 overflow-hidden relative mb-6 animate-fade-in-up opacity-0" style={{ animationDelay: '0.05s' }}>
        {/* Background Pattern */}
        <div className="h-32 bg-green-500 dark:bg-green-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent bg-[length:20px_20px]"></div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-green-400 rounded-full mix-blend-multiply filter blur-2xl opacity-50"></div>
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-yellow-300 rounded-full mix-blend-multiply filter blur-2xl opacity-50"></div>
        </div>

        <div className="px-6 pb-6 relative z-10 -mt-16 flex flex-col items-center">
          {/* Avatar */}
          <div className={`w-32 h-32 rounded-full bg-white dark:bg-gray-800 border-4 border-white dark:border-gray-800 shadow-md flex items-center justify-center text-6xl mb-4 transition-transform ${isEditing ? 'scale-105' : ''}`}>
            {isEditing ? editForm.avatar : profile.avatar}
          </div>

          {/* Edit Mode: Avatar Selector */}
          {isEditing && (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-2xl mb-6 w-full">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-300 uppercase text-center mb-3">Choose Avatar</p>
              <div className="grid grid-cols-6 gap-2">
                {AVATARS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setEditForm({...editForm, avatar: emoji})}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg text-2xl transition-all ${editForm.avatar === emoji ? 'bg-white dark:bg-gray-600 shadow-md scale-110 border border-green-200' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name Info */}
          {isEditing ? (
            <div className="w-full space-y-4 mb-4">
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">Full Name</label>
                <input 
                  type="text" 
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border-none font-bold text-center text-gray-800 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase ml-1">Nickname</label>
                <input 
                  type="text" 
                  value={editForm.nickname}
                  onChange={(e) => setEditForm({...editForm, nickname: e.target.value})}
                  placeholder="e.g. Chef Mike"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border-none font-medium text-center text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="text-center mb-2">
              <h2 className="text-2xl font-extrabold text-gray-800 dark:text-white">{profile.name}</h2>
              {profile.nickname && <p className="text-green-600 dark:text-green-400 font-medium">@{profile.nickname}</p>}
            </div>
          )}
          
          {!isEditing && (
            <div className="flex gap-2 mt-2">
               <span className="text-xs font-bold bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-full">
                 Member since {new Date(profile.createdAt).getFullYear()}
               </span>
            </div>
          )}
        </div>
      </div>

      {/* Preferences Section */}
      <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 ml-1">Food Preferences</h3>
        
        {/* Diet */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-lg">
              <Utensils size={18} />
            </div>
            <h4 className="font-bold text-gray-700 dark:text-gray-200">Dietary Goals</h4>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              DIETS.map(diet => (
                <button
                  key={diet}
                  onClick={() => setEditForm({
                    ...editForm, 
                    dietaryPreferences: toggleList(editForm.dietaryPreferences, diet)
                  })}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                    editForm.dietaryPreferences.includes(diet)
                      ? 'bg-green-600 text-white border-green-600 shadow-md transform scale-105'
                      : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {diet}
                </button>
              ))
            ) : (
              profile.dietaryPreferences.length > 0 ? (
                profile.dietaryPreferences.map(diet => (
                  <span key={diet} className="px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm font-bold">
                    {diet}
                  </span>
                ))
              ) : (
                <p className="text-gray-400 dark:text-gray-500 text-sm italic">No specific diet set.</p>
              )
            )}
          </div>
        </div>

        {/* Allergies */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
             <div className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg">
              <AlertTriangle size={18} />
            </div>
            <h4 className="font-bold text-gray-700 dark:text-gray-200">Allergies</h4>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              ALLERGIES.map(allergy => (
                <button
                  key={allergy}
                  onClick={() => setEditForm({
                    ...editForm, 
                    allergies: toggleList(editForm.allergies, allergy)
                  })}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                    editForm.allergies.includes(allergy)
                      ? 'bg-red-500 text-white border-red-500 shadow-md transform scale-105'
                      : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {allergy}
                </button>
              ))
            ) : (
              profile.allergies.length > 0 ? (
                profile.allergies.map(allergy => (
                  <span key={allergy} className="px-3 py-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm font-bold">
                    {allergy}
                  </span>
                ))
              ) : (
                <p className="text-gray-400 dark:text-gray-500 text-sm italic">No allergies listed.</p>
              )
            )}
          </div>
        </div>
      </div>

      {/* Favorites Section */}
      <div className="mt-6 space-y-4 animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 ml-1 flex items-center gap-2">
            <Heart size={20} className="text-red-500" /> My Favorites
            {favoriteRecipes.length > 0 && (
              <span className="text-sm font-normal text-gray-400">({favoriteRecipes.length})</span>
            )}
          </h3>
          {favoriteRecipes.length > 3 && (
            <button
              onClick={() => setShowAllFavorites(!showAllFavorites)}
              className="text-sm font-bold text-green-600 dark:text-green-400 hover:underline"
            >
              {showAllFavorites ? 'Show Less' : 'View All'}
            </button>
          )}
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          {favoriteRecipes.length > 0 ? (
            <div className="space-y-3">
              {(showAllFavorites ? favoriteRecipes : favoriteRecipes.slice(0, 3)).map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onRemove={() => {
                    removeFavorite(recipe.id);
                    showUndo(
                      `"${recipe.title}" removed from favorites`,
                      () => addFavorite(recipe.id, recipe)
                    );
                  }}
                  isFavorite
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <Heart size={28} className="text-red-300 dark:text-red-700" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No favorites yet.</p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Start saving recipes you love!</p>
            </div>
          )}
        </div>
      </div>

      {/* Saved for Later Section */}
      <div className="mt-6 space-y-4 animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 ml-1 flex items-center gap-2">
            <Bookmark size={20} className="text-blue-500" /> Saved for Later
            {savedRecipes.length > 0 && (
              <span className="text-sm font-normal text-gray-400">({savedRecipes.length})</span>
            )}
          </h3>
          {savedRecipes.length > 3 && (
            <button
              onClick={() => setShowAllSaved(!showAllSaved)}
              className="text-sm font-bold text-green-600 dark:text-green-400 hover:underline"
            >
              {showAllSaved ? 'Show Less' : 'View All'}
            </button>
          )}
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          {savedRecipes.length > 0 ? (
            <div className="space-y-3">
              {(showAllSaved ? savedRecipes : savedRecipes.slice(0, 3)).map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onRemove={() => {
                    removeSavedForLater(recipe.id);
                    showUndo(
                      `"${recipe.title}" removed from saved`,
                      () => addSavedForLater(recipe.id, recipe)
                    );
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <Bookmark size={28} className="text-blue-300 dark:text-blue-700" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Nothing saved yet.</p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Save recipes to try later!</p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Action Buttons */}
      {isEditing && (
        <div className="fixed bottom-24 left-4 right-4 flex gap-3 z-50 animate-in slide-in-from-bottom-10">
          <button 
            onClick={handleCancel}
            className="flex-1 py-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2"
          >
            <X size={20} /> Cancel
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 py-4 bg-gray-900 dark:bg-green-600 text-white rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2"
          >
            <Save size={20} /> Save Changes
          </button>
        </div>
      )}
    </div>
  );
};

export default Profile;