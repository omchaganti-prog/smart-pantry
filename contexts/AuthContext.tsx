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
  enterGuestMode: () => void;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

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

  const login = () => {
    localStorage.removeItem('guest_mode');
    window.location.href = '/api/login';
  };

  const logout = () => {
    localStorage.removeItem('guest_mode');
    setIsGuest(false);
    window.location.href = '/api/logout';
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
