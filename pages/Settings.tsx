
import React, { useState, useEffect } from 'react';
import { getUserProfile, saveUserProfile, clearItems, clearShoppingList } from '../services/storageService';
import { UserProfile, ThemePreference, SkillLevel } from '../types';
import { 
  Moon, Sun, Bell, Scale, Flame, Trash2, 
  ChevronRight, Info, ArrowLeft, Shield, Users, 
  ChefHat, Palette, Lock, Activity, Layers, Smartphone, User, LogOut, AlertTriangle, X, Plus, BookOpen
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PINSetupModal from '../components/PINSetupModal';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, ACCENT_COLOR_MAP } from '../contexts/ThemeContext';
import { useCookingSkill, SKILL_LABELS } from '../contexts/CookingSkillContext';
import { useSpiceTolerance, getSpiceLabelFromValue } from '../contexts/SpiceToleranceContext';
import { useAllergy } from '../contexts/AllergyContext';
import { useUndo } from '../contexts/UndoContext';
import { useWalkthrough } from '../contexts/WalkthroughContext';

const THEME_COLORS: Record<ThemePreference, string> = {
  [ThemePreference.BASIL]: 'bg-green-500',
  [ThemePreference.TOMATO]: 'bg-red-500',
  [ThemePreference.LEMON]: 'bg-yellow-400',
  [ThemePreference.BLUEBERRY]: 'bg-blue-600',
  [ThemePreference.LATTE]: 'bg-stone-500',
};

const Settings: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'account' | 'general' | 'ai_chef' | 'safety' | 'system'>('account');
  const [showPINModal, setShowPINModal] = useState(false);
  const [selectedColor, setSelectedColor] = useState<ThemePreference | null>(null);
  const navigate = useNavigate();
  const { user, isGuest, login, logout } = useAuth();
  const { accentTheme, setAccentTheme, isDarkMode, setIsDarkMode } = useTheme();
  const { skillLevel, setSkillLevel } = useCookingSkill();
  const { spiceTolerance, setSpiceTolerance, currentSpiceLabel } = useSpiceTolerance();
  const { allergies, addAllergy, removeAllergy } = useAllergy();
  const { showUndo } = useUndo();
  const { startWalkthrough } = useWalkthrough();
  const [allergyInput, setAllergyInput] = useState('');

  useEffect(() => {
    setProfile(getUserProfile());
  }, []);

  const updateSetting = (key: keyof UserProfile['settings'], value: any) => {
    if (!profile) return;
    
    const currentSettings = profile.settings;
    const updatedProfile = {
      ...profile,
      settings: {
        ...currentSettings,
        [key]: value
      }
    };
    setProfile(updatedProfile);
    saveUserProfile(updatedProfile);
    
    // Immediate effect for theme toggle
    if (key === 'theme') {
       if (value === 'dark') {
         document.documentElement.classList.add('dark');
       } else {
         document.documentElement.classList.remove('dark');
       }
    }
  };
  
  const updateNestedSetting = (parent: 'household' | 'notifications' | 'security' | 'aiPersona', key: string, value: any) => {
    if (!profile) return;
    const currentSettings = profile.settings;
    const updatedProfile = {
      ...profile,
      settings: {
        ...currentSettings,
        [parent]: {
          ...currentSettings[parent],
          [key]: value
        }
      }
    };
    setProfile(updatedProfile);
    saveUserProfile(updatedProfile);
  };

  const handleClearData = (type: 'pantry' | 'all') => {
    if (type === 'pantry') {
      if (window.confirm("Delete all items in your pantry?")) {
        clearItems();
        alert("Pantry cleared.");
      }
    } else {
      if (window.confirm("Reset EVERYTHING? This deletes pantry, shopping list, and plans.")) {
        clearItems();
        clearShoppingList();
        alert("App reset complete.");
      }
    }
  };

  const handlePINToggle = (enabled: boolean) => {
    if (enabled) {
      setShowPINModal(true);
    } else {
      updateNestedSetting('security', 'pinLock', false);
    }
  };

  const handlePINConfirm = (pin: string) => {
    updateNestedSetting('security', 'pinLock', true);
    alert("PIN code set successfully!");
  };

  if (!profile) return null;
  const s = profile.settings;

  const renderTabButton = (id: typeof activeTab, label: string, icon: React.ReactNode) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-3 px-1 flex flex-col items-center gap-1 border-b-2 transition-all active:scale-95 ${
        activeTab === id 
          ? 'border-gray-800 dark:border-white text-gray-800 dark:text-white font-bold' 
          : 'border-transparent text-gray-400 font-medium hover:text-gray-600'
      }`}
    >
      <div className={activeTab === id ? 'text-green-600 dark:text-green-400' : ''}>{icon}</div>
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
    </button>
  );

  return (
    <>
      <PINSetupModal 
        isOpen={showPINModal}
        onClose={() => setShowPINModal(false)}
        onConfirm={handlePINConfirm}
      />
      <div className="p-4 pb-28 min-h-screen bg-[#FAFAF9] dark:bg-gray-900 transition-colors duration-300">
      <header className="flex items-center gap-3 mb-6 animate-fade-in">
        <button onClick={() => navigate(-1)} className="p-2.5 bg-white dark:bg-gray-800 rounded-xl shadow-card border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 tap-scale transition-all hover:text-gray-800 dark:hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-extrabold text-gray-800 dark:text-white">Settings</h1>
      </header>

      {/* Tabs */}
      <div className="flex mb-6 bg-white dark:bg-gray-800 rounded-2xl shadow-card border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in-up opacity-0" style={{ animationDelay: '0.05s' }}>
        {renderTabButton('account', 'Account', <User size={18} />)}
        {renderTabButton('general', 'General', <Layers size={18} />)}
        {renderTabButton('ai_chef', 'AI Chef', <ChefHat size={18} />)}
        {renderTabButton('system', 'System', <Smartphone size={18} />)}
      </div>

      <div className="space-y-6 animate-fade-in-up opacity-0" style={{ animationDelay: '0.1s' }}>
        
        {/* === ACCOUNT TAB === */}
        {activeTab === 'account' && (
          <>
            {/* User Info Card */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-500 p-6 rounded-3xl shadow-lg text-white">
              <div className="flex items-center gap-4 mb-4">
                {user?.profileImageUrl ? (
                  <img 
                    src={user.profileImageUrl} 
                    alt="Profile" 
                    className="w-16 h-16 rounded-full object-cover border-2 border-white/30"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl">
                    {isGuest ? '👤' : (user?.firstName?.[0] || '?')}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold">
                    {isGuest ? 'Guest User' : (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User')}
                  </h2>
                  <p className="text-sm text-white/80">
                    {isGuest ? 'Sign in to sync your data' : user?.email || 'No email'}
                  </p>
                </div>
              </div>
              {isGuest && (
                <button 
                  onClick={login}
                  className="w-full py-3 bg-white text-green-600 rounded-xl font-bold active:scale-95 transition-transform"
                >
                  Sign In to Sync Data
                </button>
              )}
            </div>

            {/* Account Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <User size={18} className="text-blue-500" /> Account
              </h3>
              
              <div className="space-y-3">
                <button 
                  onClick={() => navigate('/profile')}
                  className="w-full py-3 px-4 bg-gray-50 dark:bg-gray-700 rounded-xl flex items-center justify-between active:scale-95 transition-transform"
                >
                  <span className="font-medium text-gray-700 dark:text-gray-200">Edit Profile</span>
                  <ChevronRight size={18} className="text-gray-400" />
                </button>

                <button 
                  onClick={logout}
                  className="w-full py-3 px-4 bg-gray-50 dark:bg-gray-700 rounded-xl flex items-center gap-3 active:scale-95 transition-transform text-red-500"
                >
                  <LogOut size={18} />
                  <span className="font-medium">{isGuest ? 'Exit Guest Mode' : 'Sign Out'}</span>
                </button>
              </div>
            </div>

            {/* Privacy & Security */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <Shield size={18} className="text-green-500" /> Privacy & Security
              </h3>
              
              <div className="space-y-3">
                <button 
                  onClick={() => navigate('/profile')}
                  className="w-full py-3 px-4 bg-gray-50 dark:bg-gray-700 rounded-xl flex items-center justify-between active:scale-95 transition-transform"
                >
                  <span className="font-medium text-gray-700 dark:text-gray-200">Manage Allergies</span>
                  <ChevronRight size={18} className="text-gray-400" />
                </button>

                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <span className="text-sm font-medium dark:text-gray-300">Biometric Unlock</span>
                  <div onClick={() => updateNestedSetting('security', 'biometricEnabled', !s.security.biometricEnabled)} className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-all duration-200 ease-out ${s.security.biometricEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-out ${s.security.biometricEnabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <span className="text-sm font-medium dark:text-gray-300">PIN Code</span>
                  <div onClick={() => handlePINToggle(!s.security.pinLock)} className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-all duration-200 ease-out ${s.security.pinLock ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-out ${s.security.pinLock ? 'translate-x-4' : 'translate-x-0'}`}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            {!isGuest && (
              <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-red-100 dark:border-red-900/50">
                <h3 className="font-bold text-red-600 dark:text-red-400 mb-4">Danger Zone</h3>
                <button 
                  onClick={() => {
                    if (window.confirm("Delete your account? This cannot be undone.")) {
                      fetch('/api/auth/user', { method: 'DELETE', credentials: 'include' })
                        .then(() => window.location.href = '/')
                        .catch(() => alert("Failed to delete account"));
                    }
                  }}
                  className="w-full py-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-bold active:scale-95 transition-transform"
                >
                  Delete Account
                </button>
              </div>
            )}
          </>
        )}

        {/* === GENERAL TAB === */}
        {activeTab === 'general' && (
          <>
            {/* Profile Card */}
            <div onClick={() => navigate('/profile')} className="bg-gradient-to-r from-gray-800 to-gray-700 dark:from-gray-800 dark:to-black p-5 rounded-3xl shadow-lg text-white flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-2xl backdrop-blur-sm border border-white/20">
                  {profile.avatar}
                </div>
                <div>
                   <h2 className="text-lg font-bold">{profile.name}</h2>
                   <p className="text-xs text-gray-300">Tap to edit profile</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-400" />
            </div>

            {/* Household Size */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
               <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                 <Users size={18} className="text-blue-500" /> Household
               </h3>
               <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-4">
                 <div>
                   <p className="font-medium text-sm text-gray-700 dark:text-gray-200">Adults</p>
                   <p className="text-xs text-gray-400">12+ years</p>
                 </div>
                 <div className="flex items-center gap-3">
                   <button onClick={() => updateNestedSetting('household', 'adults', Math.max(1, s.household.adults - 1))} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300">-</button>
                   <span className="font-bold text-lg w-4 text-center dark:text-white">{s.household.adults}</span>
                   <button onClick={() => updateNestedSetting('household', 'adults', Math.min(10, s.household.adults + 1))} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300">+</button>
                 </div>
               </div>
               <div className="flex justify-between items-center">
                 <div>
                   <p className="font-medium text-sm text-gray-700 dark:text-gray-200">Children</p>
                   <p className="text-xs text-gray-400">Under 12</p>
                 </div>
                 <div className="flex items-center gap-3">
                   <button onClick={() => updateNestedSetting('household', 'children', Math.max(0, s.household.children - 1))} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300">-</button>
                   <span className="font-bold text-lg w-4 text-center dark:text-white">{s.household.children}</span>
                   <button onClick={() => updateNestedSetting('household', 'children', Math.min(10, s.household.children + 1))} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300">+</button>
                 </div>
               </div>
            </div>

            {/* Visual Theme */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
               <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                 <Palette size={18} className="text-purple-500" /> App Theme
               </h3>
               
               {/* Dark/Light Toggle */}
               <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-6">
                 <button onClick={() => setIsDarkMode(false)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${!isDarkMode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                   <Sun size={14} /> Light
                 </button>
                 <button onClick={() => setIsDarkMode(true)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${isDarkMode ? 'bg-gray-600 shadow-sm text-white' : 'text-gray-400'}`}>
                   <Moon size={14} /> Dark
                 </button>
               </div>

               {/* Accent Color */}
               <p className="text-xs font-bold text-gray-400 uppercase mb-3">Accent Color</p>
               <div className="flex justify-between gap-2">
                 {Object.values(ThemePreference).map(themeName => (
                   <button
                     key={themeName}
                     onClick={() => {
                       setSelectedColor(themeName);
                       setAccentTheme(themeName);
                       setTimeout(() => setSelectedColor(null), 200);
                     }}
                     className={`w-10 h-10 rounded-full ${THEME_COLORS[themeName]} shadow-sm flex items-center justify-center transition-all duration-200 ${
                       accentTheme === themeName 
                         ? 'scale-110 ring-4 ring-offset-2 ring-offset-white dark:ring-offset-gray-800' 
                         : 'opacity-70 hover:opacity-100 hover:scale-105'
                     } ${selectedColor === themeName ? 'scale-95' : ''}`}
                     style={{ 
                       boxShadow: accentTheme === themeName ? `0 0 20px ${ACCENT_COLOR_MAP[themeName].primary}40` : undefined 
                     }}
                   >
                     {accentTheme === themeName && <div className="w-3 h-3 bg-white rounded-full animate-pulse" />}
                   </button>
                 ))}
               </div>
               <p className="text-center text-xs font-medium text-gray-400 mt-2">{accentTheme} Theme</p>
            </div>
          </>
        )}

        {/* === AI CHEF TAB === */}
        {activeTab === 'ai_chef' && (
           <>
             {/* Skill Level */}
             <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <Activity size={18} className="text-orange-500" /> Cooking Skill
                </h3>
                <div className="grid grid-cols-2 gap-3">
                   {Object.values(SkillLevel).map(level => (
                     <button
                       key={level}
                       onClick={() => {
                         setSkillLevel(level);
                         updateSetting('skillLevel', level);
                       }}
                       className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all duration-200 active:scale-95 ${
                         skillLevel === level 
                           ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-500 text-orange-700 dark:text-orange-400 ring-2 ring-orange-200 dark:ring-orange-800 shadow-sm' 
                           : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 hover:border-orange-300'
                       }`}
                     >
                       {level}
                     </button>
                   ))}
                </div>
                <p className="text-center text-xs text-gray-400 mt-3 font-medium">
                  Recipes matched to {skillLevel.toLowerCase()} skill level
                </p>
             </div>

             {/* Spiciness & Units */}
             <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
               <div className="mb-6">
                 <h3 className="font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                   <Flame size={18} className="text-red-500" /> Spice Tolerance
                 </h3>
                 <div className="relative pt-8">
                   <input 
                    type="range" min="0" max="100" step="1"
                    value={spiceTolerance}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      setSpiceTolerance(value);
                      const bucket = value <= 25 ? 0 : value <= 50 ? 1 : value <= 75 ? 2 : 3;
                      updateSetting('spicinessLevel', bucket);
                    }}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                   />
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg transition-all">
                     {currentSpiceLabel}
                   </div>
                 </div>
                 <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-bold uppercase">
                   <span>Mild</span>
                   <span>Medium</span>
                   <span>Spicy</span>
                   <span>Fiery</span>
                 </div>
                 <p className="text-center text-xs text-gray-400 mt-3 font-medium">
                   Recipes matched to your spice tolerance
                 </p>
               </div>

               <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <Scale size={18} className="text-blue-500" /> Units
                  </h3>
                  <button 
                    onClick={() => updateSetting('measurements', s.measurements === 'metric' ? 'imperial' : 'metric')}
                    className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg"
                  >
                    {s.measurements === 'metric' ? 'Metric (g)' : 'Imperial (oz)'}
                  </button>
               </div>
             </div>

             {/* AI Persona */}
             <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
               <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                 <ChefHat size={18} className="text-green-500" /> AI Style
               </h3>
               <div className="space-y-4">
                 <div className="flex justify-between items-center">
                   <span className="text-sm font-medium dark:text-gray-300">Recipe Style</span>
                   <select 
                     value={s.aiPersona.mealStyle}
                     onChange={(e) => updateNestedSetting('aiPersona', 'mealStyle', e.target.value)}
                     className="bg-gray-100 dark:bg-gray-700 text-sm font-bold p-2 rounded-lg outline-none"
                   >
                     <option>Quick</option>
                     <option>Gourmet</option>
                     <option>Healthy</option>
                     <option>Budget</option>
                   </select>
                 </div>
               </div>
             </div>

             {/* Allergy Management */}
             <div data-walkthrough="allergy-settings" className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-red-100 dark:border-red-900/30">
               <h3 className="font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                 <AlertTriangle size={18} className="text-red-500" /> Food Allergies
               </h3>
               <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                 Recipes containing these ingredients will be hidden automatically.
               </p>
               
               {/* Allergy Input */}
               <div className="flex gap-2 mb-4">
                 <input
                   type="text"
                   value={allergyInput}
                   onChange={(e) => setAllergyInput(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' || e.key === ',') {
                       e.preventDefault();
                       const value = allergyInput.replace(',', '').trim();
                       if (value) {
                         addAllergy(value);
                         setAllergyInput('');
                       }
                     }
                   }}
                   placeholder="Type allergy (e.g., nuts, eggs, milk)"
                   className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                 />
                 <button
                   onClick={() => {
                     const value = allergyInput.replace(',', '').trim();
                     if (value) {
                       addAllergy(value);
                       setAllergyInput('');
                     }
                   }}
                   disabled={!allergyInput.trim()}
                   className="px-4 py-3 bg-red-500 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
                 >
                   <Plus size={18} />
                 </button>
               </div>

               {/* Allergy Chips */}
               {allergies.length > 0 ? (
                 <div className="flex flex-wrap gap-2">
                   {allergies.map((allergy) => (
                     <div
                       key={allergy}
                       className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-sm font-bold border border-red-200 dark:border-red-800"
                     >
                       <span className="capitalize">{allergy}</span>
                       <button
                         onClick={() => {
                           removeAllergy(allergy);
                           showUndo(
                             `"${allergy}" allergy removed`,
                             () => addAllergy(allergy)
                           );
                         }}
                         className="w-5 h-5 rounded-full bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-300 flex items-center justify-center hover:bg-red-300 dark:hover:bg-red-700 transition-colors"
                       >
                         <X size={12} />
                       </button>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="text-center py-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                   <p className="text-sm text-gray-400">No allergies added</p>
                   <p className="text-xs text-gray-400 mt-1">All recipes will be shown</p>
                 </div>
               )}

               {allergies.length > 0 && (
                 <p className="text-xs text-red-600 dark:text-red-400 mt-4 font-medium flex items-center gap-1">
                   <Shield size={12} /> {allergies.length} allerg{allergies.length === 1 ? 'y' : 'ies'} will be filtered from all recipes
                 </p>
               )}
             </div>
           </>
        )}

        {/* === SAFETY TAB === */}
        {activeTab === 'safety' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
             <div className="text-center py-6">
                <Shield size={48} className="mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Safety First</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Manage security and allergy alerts.
                </p>
                <button onClick={() => navigate('/profile')} className="w-full py-3 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-300 mb-4">
                   Manage Allergies
                </button>
             </div>

             <h4 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
               <Lock size={16} className="text-gray-400" /> App Security
             </h4>
             <div className="space-y-3">
               <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                 <span className="text-sm font-medium dark:text-gray-300">Biometric Unlock</span>
                 <div onClick={() => updateNestedSetting('security', 'biometricEnabled', !s.security.biometricEnabled)} className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${s.security.biometricEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                   <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${s.security.biometricEnabled ? 'translate-x-4' : ''}`}></div>
                 </div>
               </div>
               <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl active:scale-95 transition-transform">
                 <span className="text-sm font-medium dark:text-gray-300">PIN Code</span>
                 <div onClick={() => handlePINToggle(!s.security.pinLock)} className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${s.security.pinLock ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                   <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${s.security.pinLock ? 'translate-x-4' : ''}`}></div>
                 </div>
               </div>
             </div>
          </div>
        )}

        {/* === SYSTEM TAB === */}
        {activeTab === 'system' && (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                 <Bell size={18} className="text-pink-500" /> Notifications
              </h3>
              <div className="space-y-3">
                 {[
                   { k: 'enabled', l: 'Enable All' },
                   { k: 'expiryAlerts', l: 'Expiration Alerts' },
                   { k: 'mealReminders', l: 'Meal Plan Reminders' },
                   { k: 'missingItems', l: 'Shopping List Alerts' }
                 ].map((item: any) => (
                   <div key={item.k} className="flex justify-between items-center">
                     <span className="text-sm text-gray-600 dark:text-gray-300">{item.l}</span>
                     <div onClick={() => updateNestedSetting('notifications', item.k, !s.notifications[item.k as keyof typeof s.notifications])} className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${s.notifications[item.k as keyof typeof s.notifications] ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${s.notifications[item.k as keyof typeof s.notifications] ? 'translate-x-4' : ''}`}></div>
                     </div>
                   </div>
                 ))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
               <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                 <Trash2 size={18} className="text-red-500" /> Data Management
               </h3>
               <div className="space-y-3">
                 <button onClick={() => handleClearData('pantry')} className="w-full py-3 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20">
                    Clear Pantry Items
                 </button>
                 <button onClick={() => handleClearData('all')} className="w-full py-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-sm font-bold">
                    Factory Reset App
                 </button>
               </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
               <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                 <BookOpen size={18} className="text-blue-500" /> Help & Tutorials
               </h3>
               <button 
                 onClick={startWalkthrough}
                 className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 tap-scale shadow-md hover:shadow-lg transition-all"
               >
                 <BookOpen size={16} />
                 Replay App Walkthrough
               </button>
               <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-3">
                 See the guided tour of all app features
               </p>
            </div>

            <div className="text-center py-6">
              <div className="inline-flex items-center gap-2 text-gray-400 text-xs font-medium bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                <Info size={12} />
                <span>SmartPantry Pro v2.1.0</span>
              </div>
            </div>
          </>
        )}

      </div>
      </div>
    </>
  );
};

export default Settings;
