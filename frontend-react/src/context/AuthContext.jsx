import React, { createContext, useContext, useState, useEffect } from 'react';
import { getToken, setToken } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.warn("useAuth must be used within an AuthProvider. Context is undefined.");
    return {};
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(getToken());
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('agri_user') || 'null'); }
    catch { return null; }
  });

  // loginUser: called after successful OTP verification or registration
  const loginUser = (newToken, newUser) => {
    setToken(newToken);
    setTokenState(newToken);
    localStorage.setItem('agri_user', JSON.stringify(newUser));
    setUser(newUser);
  };

  // login: alias used by dashboards for updating user after profile save
  const login = (newUser, newToken) => {
    const tok = newToken || token;
    setToken(tok);
    setTokenState(tok);
    localStorage.setItem('agri_user', JSON.stringify(newUser));
    setUser(newUser);
  };

  const logout = () => {
    setToken('');
    setTokenState('');
    localStorage.removeItem('agri_user');
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      isLoggedIn: !!user, 
      isFarmer: user?.role === 'farmer',
      loginUser,
      login,       // alias used by dashboards
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};
