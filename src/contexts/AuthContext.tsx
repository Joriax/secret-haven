import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  login: (userId: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing session
    const storedUserId = sessionStorage.getItem('vault_user_id');
    const sessionExpiry = sessionStorage.getItem('vault_session_expiry');
    
    if (storedUserId && sessionExpiry) {
      const expiry = new Date(sessionExpiry);
      if (expiry > new Date()) {
        setIsAuthenticated(true);
        setUserId(storedUserId);
      } else {
        // Session expired
        sessionStorage.removeItem('vault_user_id');
        sessionStorage.removeItem('vault_session_expiry');
      }
    }
  }, []);

  const login = (userId: string) => {
    // Set session for 24 hours
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    
    sessionStorage.setItem('vault_user_id', userId);
    sessionStorage.setItem('vault_session_expiry', expiry.toISOString());
    
    setIsAuthenticated(true);
    setUserId(userId);
  };

  const logout = () => {
    sessionStorage.removeItem('vault_user_id');
    sessionStorage.removeItem('vault_session_expiry');
    setIsAuthenticated(false);
    setUserId(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
