import React, { useState } from 'react';
import { ChefHat, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import GoogleSignInButton from '../components/GoogleSignInButton';

const Login: React.FC = () => {
  const { enterGuestMode, signInWithGoogle, googleClientId } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleGoogleCredential = async (credential: string) => {
    setError(null);
    try {
      await signInWithGoogle(credential);
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed.');
    }
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
            {googleClientId ? (
              <>
                <GoogleSignInButton
                  clientId={googleClientId}
                  onCredential={handleGoogleCredential}
                  onError={setError}
                />
                <p className="text-center text-xs text-gray-400">
                  Your pantry, recipes and preferences sync to your Google account
                </p>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-4 text-center">
                <p className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-1">
                  Google sign-in isn't set up yet
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Add <code className="font-mono">GOOGLE_CLIENT_ID</code> to the server's{' '}
                  <code className="font-mono">.env</code> and restart it. You can keep using
                  the app as a guest in the meantime.
                </p>
              </div>
            )}
            {error && (
              <p className="text-center text-xs font-semibold text-red-500">{error}</p>
            )}
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
            <span className="text-sm">Secure sign-in with your Google account</span>
          </div>
          <p className="text-center text-xs text-gray-400">
            Guest mode keeps everything on this device only
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
