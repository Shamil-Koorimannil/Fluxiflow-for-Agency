import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getAccessToken, getRefreshToken, setTokens, clearTokens } from '../../services/api';
import type { User } from '../../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/auth/me/');
      setUser(response.data);
      localStorage.setItem('userRole', response.data.role);
    } catch (error) {
      clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      fetchCurrentUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login/', { email, password });
      const { access, refresh, user: userData } = response.data;
      setTokens(access, refresh);
      setUser(userData);
      localStorage.setItem('userRole', userData.role);
      setIsLoading(false);
      return userData;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      const refresh = getRefreshToken();
      await api.post('/auth/logout/', { refresh });
    } catch (error) {
      // Ignore network errors on logout
    } finally {
      clearTokens();
      setUser(null);
      setIsLoading(false);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('userRole', updatedUser.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        updateUser,
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
