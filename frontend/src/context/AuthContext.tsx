import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '../types';
import { apiFetch, setStoredToken } from '../services/api';
import { nexconn } from '../services/nexconn';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  switchDemoUser: (role: 'buyer' | 'seller' | 'support') => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchMe = useCallback(async () => {
    try {
      console.log('[AUTH_ME_REQUEST] Fetching current user identity');
      const data = await apiFetch<User>('/auth/me');
      setUser(data);
      console.log('[AUTH_SESSION_VALID] Authenticated user:', data.email);
      // Connect Nexconn for this specific authenticated user
      await nexconn.initAndConnect();
    } catch {
      console.log('[AUTH_SESSION_INVALID] No active session found');
      setUser(null);
      await nexconn.disconnect();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();

    const handleAuthExpired = async () => {
      console.log('[AUTH_SESSION_EXPIRED] Clearing session and disconnecting Nexconn');
      setUser(null);
      await nexconn.disconnect();
    };

    window.addEventListener('accord:auth_expired', handleAuthExpired);
    return () => window.removeEventListener('accord:auth_expired', handleAuthExpired);
  }, [fetchMe]);

  const login = async (email: string, pass: string) => {
    console.log('[AUTH_LOGIN_ATTEMPT]', email);
    // 1. If a previous session exists, disconnect Nexconn and clear cache first
    await nexconn.disconnect();

    // 2. Perform backend authentication
    const res = await apiFetch<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });

    console.log('[AUTH_LOGIN_SUCCESS]', res.user.email);
    setStoredToken(res.access_token);
    setUser(res.user);

    // 3. Centralized Nexconn initialization for the newly authenticated user
    await nexconn.initAndConnect();
  };

  const signup = async (name: string, email: string, pass: string) => {
    await nexconn.disconnect();
    const res = await apiFetch<{ access_token: string; user: User }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password: pass }),
    });
    setStoredToken(res.access_token);
    setUser(res.user);
    await nexconn.initAndConnect();
  };

  const logout = async () => {
    console.log('[AUTH_LOGOUT] Terminating session');
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Invalidate client even if backend request fails
    }
    setStoredToken(null);
    setUser(null);
    await nexconn.disconnect();
    window.location.href = '/login';
  };

  const switchDemoUser = async (role: 'buyer' | 'seller' | 'support') => {
    console.log('[NEXCONN_USER_SWITCH] Switching demo user to:', role);
    const emails = {
      buyer: 'buyer@accord.demo',
      seller: 'seller@accord.demo',
      support: 'support@accord.demo',
    };
    await login(emails[role], 'AccordDemo2026!');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, switchDemoUser, refreshUser: fetchMe }}>
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
