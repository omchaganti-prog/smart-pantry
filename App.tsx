import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import Dashboard from './pages/Dashboard';
import Scanner from './pages/Scanner';
import PantryList from './pages/PantryList';
import Recipes from './pages/Recipes';
import History from './pages/History';
import ShoppingList from './pages/ShoppingList';
import MealPlanner from './pages/MealPlanner';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Login from './pages/Login';
import NavBar from './components/NavBar';
import PageTransition from './components/PageTransition';
import Walkthrough from './components/Walkthrough';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CookingSkillProvider } from './contexts/CookingSkillContext';
import { SpiceToleranceProvider } from './contexts/SpiceToleranceContext';
import { FavoritesProvider } from './contexts/FavoritesContext';
import { AllergyProvider } from './contexts/AllergyContext';
import { WalkthroughProvider } from './contexts/WalkthroughContext';
import { RecentlyViewedProvider } from './contexts/RecentlyViewedContext';
import { UndoProvider } from './contexts/UndoContext';
import UndoToast from './components/UndoToast';
import LockScreen from './components/LockScreen';
import { isPinSet, isUnlocked } from './services/pinService';
import { getUserProfile } from './services/storageService';

const queryClient = new QueryClient();

const AppContent: React.FC = () => {
  const location = useLocation();
  const { isLoading, isAuthenticated } = useAuth();

  // Settings → PIN Lock. Unlocking lasts for the browser session.
  const [locked, setLocked] = useState(() => {
    const pinEnabled = getUserProfile()?.settings?.security?.pinLock;
    return Boolean(pinEnabled) && isPinSet() && !isUnlocked();
  });

  const showNav = location.pathname !== '/scan' && location.pathname !== '/login';

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9] dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <>
      <div className="max-w-md mx-auto min-h-screen bg-[#FAFAF9] dark:bg-gray-900 relative shadow-2xl overflow-hidden text-gray-800 dark:text-gray-100 transition-colors duration-300">
        <PageTransition>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scan" element={<Scanner />} />
            <Route path="/pantry" element={<PantryList />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/history" element={<History />} />
            <Route path="/shopping" element={<ShoppingList />} />
            <Route path="/planner" element={<MealPlanner />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </PageTransition>
        {showNav && <NavBar />}
      </div>
      <Walkthrough />
      <UndoToast />
    </>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CookingSkillProvider>
          <SpiceToleranceProvider>
            <FavoritesProvider>
              <AllergyProvider>
                <RecentlyViewedProvider>
                  <UndoProvider>
                    <WalkthroughProvider>
                      <AuthProvider>
                        <Router>
                          <AppContent />
                        </Router>
                      </AuthProvider>
                    </WalkthroughProvider>
                  </UndoProvider>
                </RecentlyViewedProvider>
              </AllergyProvider>
            </FavoritesProvider>
          </SpiceToleranceProvider>
        </CookingSkillProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
