import React, { createContext, useContext, useEffect, useState } from 'react';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchMe = async () => {
    try {
      const data = await apiFetch<User>('/auth/me');
      setUser(data);
      // Trigger Nexconn lifecycle connect
      nexconn.initAndConnect();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();

    const handleAuthExpired = () => {
      setUser(null);
      nexconn.disconnect();
    };

    window.addEventListener('accord:auth_expired', handleAuthExpired);
    return () => window.removeEventListener('accord:auth_expired', handleAuthExpired);
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await apiFetch<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });
    setStoredToken(res.access_token);
    setUser(res.user);
    await nexconn.initAndConnect();
  };

  const signup = async (name: string, email: string, pass: string) => {
    const res = await apiFetch<{ access_token: string; user: User }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password: pass }),
    });
    setStoredToken(res.access_token);
    setUser(res.user);
    await nexconn.initAndConnect();
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    setStoredToken(null);
    setUser(null);
    await nexconn.disconnect();
  };

  const switchDemoUser = async (role: 'buyer' | 'seller' | 'support') => {
    const emails = {
      buyer: 'buyer@accord.demo',
      seller: 'seller@accord.demo',
      support: 'support@accord.demo',
    };
    await login(emails[role], 'AccordDemo2026!');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, switchDemoUser }}>
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
