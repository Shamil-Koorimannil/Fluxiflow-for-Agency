import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { api, getAccessToken, getRefreshToken, setTokens, clearTokens, authChannel, API_BASE_URL } from '../../services/api';
import type { User } from '../../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  requestOtp: (email: string) => Promise<void>;
  login: (email: string, otp: string, rememberMe?: boolean) => Promise<User>;
  loginWithPassword: (email: string, password: string, rememberMe?: boolean) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      let token = getAccessToken();
      const refreshToken = getRefreshToken();

      // If access token is missing but refresh token exists, attempt refresh first
      if (!token && refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
            refresh: refreshToken
          });
          const access = res.data.access as string;
          const refresh = (res.data.refresh || refreshToken) as string;
          setTokens(access, refresh);
          token = access;
        } catch (refreshErr) {
          clearTokens();
          setUser(null);
          setIsLoading(false);
          setIsInitializing(false);
          return;
        }
      }

      if (token) {
        const response = await api.get('/auth/me/');
        setUser(response.data);
        localStorage.setItem('userRole', response.data.role);
      } else {
        setUser(null);
      }
    } catch (error) {
      clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();
    if (accessToken || refreshToken) {
      fetchCurrentUser();
    } else {
      setIsLoading(false);
      setIsInitializing(false);
    }

    const handleAuthSync = () => {
      setIsLoading(true);
      fetchCurrentUser();
    };

    const handleAuthSyncLogout = () => {
      setUser(null);
      setIsLoading(false);
      window.location.href = '/login';
    };

    window.addEventListener('auth_sync', handleAuthSync);
    window.addEventListener('auth_sync_logout', handleAuthSyncLogout);

    return () => {
      window.removeEventListener('auth_sync', handleAuthSync);
      window.removeEventListener('auth_sync_logout', handleAuthSyncLogout);
    };
  }, []);

  const requestOtp = async (email: string): Promise<void> => {
    try {
      await api.post('/auth/request-otp/', { email });
    } catch (error) {
      throw error;
    }
  };

  const login = async (email: string, otp: string, rememberMe?: boolean): Promise<User> => {
    try {
      const response = await api.post('/auth/verify-otp/', { email, otp, remember_me: rememberMe });
      const { access, refresh, user: userData } = response.data;
      setTokens(access, refresh, rememberMe);
      setUser(userData);
      localStorage.setItem('userRole', userData.role);
      return userData;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      if (authChannel) {
        authChannel.postMessage({ type: 'LOGOUT' });
      }
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

  const loginWithPassword = async (email: string, password: string, rememberMe?: boolean): Promise<User> => {
    try {
      const response = await api.post('/auth/login-password/', { email, password, remember_me: rememberMe });
      const { access, refresh, user: userData } = response.data;
      setTokens(access, refresh, rememberMe);
      setUser(userData);
      localStorage.setItem('userRole', userData.role);
      return userData;
    } catch (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isInitializing,
        requestOtp,
        login,
        loginWithPassword,
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
