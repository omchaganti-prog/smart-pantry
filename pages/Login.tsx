import React from 'react';
import { ChefHat, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const { login, enterGuestMode } = useAuth();

  const handleLogin = () => {
    login();
  };

  const handleGuestMode = () => {
    enterGuestMode();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-green-500/30">
            <ChefHat size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-800 dark:text-white mb-2">
            SmartPantry AI
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Your intelligent kitchen companion
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 space-y-6">
          <div className="space-y-3">
            <button
              onClick={handleLogin}
              className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-green-500/30 hover:shadow-green-500/50 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <Sparkles size={20} />
              Sign In
            </button>
            <p className="text-center text-xs text-gray-400">
              Sign in with Google, Apple, GitHub, or Email
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white dark:bg-gray-800 px-4 text-gray-400 uppercase tracking-wider">
                or
              </span>
            </div>
          </div>

          <button
            onClick={handleGuestMode}
            className="w-full py-4 px-6 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-bold text-lg active:scale-95 transition-all"
          >
            Continue as Guest
          </button>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <ShieldCheck size={18} className="text-green-500" />
            <span className="text-sm">Secure authentication powered by Replit</span>
          </div>
          <p className="text-center text-xs text-gray-400">
            By signing in, you agree to sync your pantry, recipes, and preferences
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
