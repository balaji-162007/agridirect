import React, { createContext, useContext, useState, useEffect } from 'react';
import { getToken, setToken, apiEvents } from '../services/api';
import { pushService } from '../services/pushService';
import PushPromptModal from '../components/PushPromptModal';
import SessionExpiredModal from '../components/SessionExpiredModal';

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
  const [showPushModal, setShowPushModal] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  // Listen for global session expiry
  useEffect(() => {
    const handleExpiry = () => {
      setIsSessionExpired(true);
    };
    apiEvents.on("sessionExpired", handleExpiry);
  }, []);

  // Check for push prompts on mount (if logged in)
  useEffect(() => {
    if (token) {
      pushService.shouldPrompt().then(should => {
        if (should) setShowPushModal(true);
      });
    }
  }, [token]);

  // loginUser: called after successful OTP verification or registration
  const loginUser = (newToken, newUser) => {
    setToken(newToken);
    setTokenState(newToken);
    localStorage.setItem('agri_user', JSON.stringify(newUser));
    setUser(newUser);
    
    // Check for push notifications after login
    pushService.shouldPrompt().then(should => {
      if (should) setShowPushModal(true);
    });
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
    setIsSessionExpired(false);
  };

  const handleAcceptPush = async () => {
    setShowPushModal(false);
    try {
      await pushService.registerServiceWorker();
      await pushService.subscribeUser();
    } catch (e) {
      console.error('Push subscription failed', e);
    }
  };

  const handleDeclinePush = () => {
    setShowPushModal(false);
    pushService.markDeclined();
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
      <PushPromptModal 
        isOpen={showPushModal}
        onAccept={handleAcceptPush}
        onDecline={handleDeclinePush}
      />
      <SessionExpiredModal 
        isOpen={isSessionExpired}
        onLogin={() => {
          logout();
          window.location.href = '/login.html';
        }}
      />
    </AuthContext.Provider>
  );
};
