import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  isDecoyMode: boolean;
  login: (userId: string, isDecoy?: boolean) => void;
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
  const [isDecoyMode, setIsDecoyMode] = useState(false);

  useEffect(() => {
    // Check for existing session
    const storedUserId = sessionStorage.getItem('vault_user_id');
    const sessionExpiry = sessionStorage.getItem('vault_session_expiry');
    const storedDecoyMode = sessionStorage.getItem('vault_decoy_mode');
    
    if (storedUserId && sessionExpiry) {
      const expiry = new Date(sessionExpiry);
      if (expiry > new Date()) {
        setIsAuthenticated(true);
        setUserId(storedUserId);
        setIsDecoyMode(storedDecoyMode === 'true');
      } else {
        // Session expired
        sessionStorage.removeItem('vault_user_id');
        sessionStorage.removeItem('vault_session_expiry');
        sessionStorage.removeItem('vault_decoy_mode');
      }
    }
  }, []);

  const login = (userId: string, isDecoy: boolean = false) => {
    // Set session for 24 hours
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    
    sessionStorage.setItem('vault_user_id', userId);
    sessionStorage.setItem('vault_session_expiry', expiry.toISOString());
    sessionStorage.setItem('vault_decoy_mode', isDecoy.toString());
    
    setIsAuthenticated(true);
    setUserId(userId);
    setIsDecoyMode(isDecoy);
  };

  const logout = () => {
    sessionStorage.removeItem('vault_user_id');
    sessionStorage.removeItem('vault_session_expiry');
    sessionStorage.removeItem('vault_decoy_mode');
    setIsAuthenticated(false);
    setUserId(null);
    setIsDecoyMode(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userId, isDecoyMode, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
