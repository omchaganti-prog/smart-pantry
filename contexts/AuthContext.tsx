import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  allergies: string[] | null;
  dietaryPreferences: string[] | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  login: () => void;
  logout: () => void;
  /** Exchanges a Google ID token for a server session. */
  signInWithGoogle: (credential: string) => Promise<void>;
  googleClientId: string | null;
  enterGuestMode: () => void;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);

  // The server owns the client id so it lives in one place (.env) rather than being
  // duplicated into the frontend bundle.
  useEffect(() => {
    fetch('/api/auth/config')
      .then(r => (r.ok ? r.json() : null))
      .then(cfg => setGoogleClientId(cfg?.googleEnabled ? cfg.googleClientId : null))
      .catch(() => setGoogleClientId(null));
  }, []);

  const signInWithGoogle = async (credential: string) => {
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ credential }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Google sign-in failed.');
    }
    localStorage.removeItem('guest_mode');
    setIsGuest(false);
    setUser(await response.json());
  };

  const fetchUser = async () => {
    try {
      const guestMode = localStorage.getItem('guest_mode');
      if (guestMode === 'true') {
        setIsGuest(true);
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/auth/user', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  // Leaving guest mode drops you on the sign-in screen, where the Google button lives.
  // (This used to redirect to /api/login, a Replit OIDC route that no longer exists.)
  const login = () => {
    localStorage.removeItem('guest_mode');
    setIsGuest(false);
    setUser(null);
  };

  const logout = async () => {
    localStorage.removeItem('guest_mode');
    setIsGuest(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* ending the local session still matters even if the request failed */
    }
    setUser(null);
    window.location.hash = '#/';
  };

  const enterGuestMode = () => {
    localStorage.setItem('guest_mode', 'true');
    setIsGuest(true);
    window.location.href = '/';
  };

  const refetchUser = async () => {
    await fetchUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user || isGuest,
        isGuest,
        login,
        logout,
        enterGuestMode,
        refetchUser,
        signInWithGoogle,
        googleClientId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
