import { createContext, useContext, useState, useCallback } from 'react';
import { login as apiLogin, setToken, clearToken, hasToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(hasToken());
  const [error, setError] = useState('');

  const login = useCallback(async (token) => {
    setError('');
    try {
      await apiLogin(token);
      setToken(token);
      setAuthenticated(true);
    } catch (err) {
      setError(err.message || 'Invalid token');
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ authenticated, login, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
