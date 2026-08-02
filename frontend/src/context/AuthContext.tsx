import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

interface User {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  authModalOpen: boolean;
  authModalMode: 'signin' | 'signup';
  login: (email: string, pass: string) => Promise<void>;
  signupSendOtp: (payload: { firstName: string; lastName: string; email: string; password: string; confirmPassword: string }) => Promise<void>;
  signupVerifyOtp: (otp: string) => Promise<void>;
  logout: () => void;
  openAuthModal: (mode?: 'signin' | 'signup') => void;
  closeAuthModal: () => void;
  fetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [loading, setLoading] = useState<boolean>(true);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await authApi.getProfile();
      const userData = res.user || res.data || res;
      if (userData) {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (err) {
      console.warn('Profile fetch warning (user unauthenticated or token expired):', err);
      // Don't clear saved token aggressively if server cookies handle session
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await authApi.login({ email, password: pass });
    if (res.loggedInUser) {
      setUser(res.loggedInUser);
      localStorage.setItem('user', JSON.stringify(res.loggedInUser));
    }
    if (res.accessToken) {
      setToken(res.accessToken);
      localStorage.setItem('accessToken', res.accessToken);
    }
    setAuthModalOpen(false);
  };

  const signupSendOtp = async (payload: { firstName: string; lastName: string; email: string; password: string; confirmPassword: string }) => {
    await authApi.sendOtp(payload);
  };

  const signupVerifyOtp = async (otp: string) => {
    await authApi.verifyOtp(otp);
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
    setToken(null);
  };

  const openAuthModal = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const isAdmin = Boolean(user?.isAdmin);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAdmin,
        authModalOpen,
        authModalMode,
        login,
        signupSendOtp,
        signupVerifyOtp,
        logout,
        openAuthModal,
        closeAuthModal,
        fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
