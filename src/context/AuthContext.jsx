import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest, setToken, getToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('omal_pos_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(15);
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    const token = getToken();
    if (token) {
      apiRequest('/auth/me')
        .then(res => {
          setUser(res.user);
          localStorage.setItem('omal_pos_user', JSON.stringify(res.user));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    const handleExpired = () => logout();
    window.addEventListener('auth_expired', handleExpired);
    return () => window.removeEventListener('auth_expired', handleExpired);
  }, []);

  // Inactivity auto-logout tracker
  useEffect(() => {
    if (!user) return;

    const updateActivity = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('touchstart', updateActivity);

    const interval = setInterval(() => {
      const elapsedMins = (Date.now() - lastActivity) / 60000;
      if (elapsedMins >= autoLogoutMinutes) {
        console.warn(`[Security] Auto logout triggered after ${autoLogoutMinutes} mins of inactivity`);
        logout();
      }
    }, 15000);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      clearInterval(interval);
    };
  }, [user, lastActivity, autoLogoutMinutes]);

  const login = async (email, password) => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('omal_pos_user', JSON.stringify(res.user));
    setLastActivity(Date.now());
    return res.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('omal_pos_user');
  };

  // Quick switch role for testing all user permission scenarios
  const switchDemoRole = async (roleEmail, rolePass) => {
    return await login(roleEmail, rolePass);
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const isSales = user?.role === 'sales';
  const isAccountant = user?.role === 'accountant' || isSuperAdmin;

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      switchDemoRole,
      isSuperAdmin,
      isAdmin,
      isSales,
      isAccountant,
      autoLogoutMinutes,
      setAutoLogoutMinutes
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
