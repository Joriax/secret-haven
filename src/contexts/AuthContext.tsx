import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://zbniouzrkbkyvkpnpwxa.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpibmlvdXpya2JreXZrcG5wd3hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMTcyMzYsImV4cCI6MjA4MTg5MzIzNn0.gTU98s049QxA0ZCco4rJYFJG5B00LaRPJbFY_6j1es8";

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  userId: string | null;
  isDecoyMode: boolean;
  sessionToken: string | null;
  supabaseClient: SupabaseClient<Database>;
  login: (userId: string, isDecoy: boolean, sessionToken: string) => void;
  logout: () => void;
  extendSession: () => void;
  sessionExpiresAt: Date | null;
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

const logSecurityEvent = async (userId: string, eventType: string, details: Record<string, any> = {}) => {
  try {
    await supabase.from('security_logs').insert({
      user_id: userId,
      event_type: eventType,
      details,
      user_agent: navigator.userAgent
    });
  } catch (error) {
    console.error('Error logging security event:', error);
  }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isDecoyMode, setIsDecoyMode] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);

  // Validate session with server on mount
  useEffect(() => {
    const validateSession = async () => {
      const storedToken = sessionStorage.getItem('vault_session_token');
      const storedUserId = sessionStorage.getItem('vault_user_id');
      
      if (!storedToken || !storedUserId) {
        setIsAuthLoading(false);
        return;
      }

      try {
        // Validate the session token with the server
        const response = await supabase.functions.invoke('verify-pin', {
          body: { action: 'validate-session', sessionToken: storedToken }
        });

        const data = response.data;
        
        if (data?.success && data?.userId) {
          // Session is valid
          const expiry = new Date();
          expiry.setHours(expiry.getHours() + 24);
          
          setIsAuthenticated(true);
          setUserId(data.userId);
          setIsDecoyMode(data.isDecoy || false);
          setSessionToken(storedToken);
          setSessionExpiresAt(expiry);
        } else {
          // Session is invalid, clear stored data
          sessionStorage.removeItem('vault_user_id');
          sessionStorage.removeItem('vault_session_token');
          sessionStorage.removeItem('vault_session_expiry');
          sessionStorage.removeItem('vault_decoy_mode');
        }
      } catch (error) {
        console.error('Session validation error:', error);
        // Clear on error
        sessionStorage.removeItem('vault_user_id');
        sessionStorage.removeItem('vault_session_token');
        sessionStorage.removeItem('vault_session_expiry');
        sessionStorage.removeItem('vault_decoy_mode');
      } finally {
        setIsAuthLoading(false);
      }
    };

    validateSession();
  }, []);

  const login = useCallback((newUserId: string, isDecoy: boolean, newSessionToken: string) => {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    
    // Store session token (server-validated) along with user info
    sessionStorage.setItem('vault_user_id', newUserId);
    sessionStorage.setItem('vault_session_token', newSessionToken);
    sessionStorage.setItem('vault_session_expiry', expiry.toISOString());
    sessionStorage.setItem('vault_decoy_mode', isDecoy.toString());
    
    setIsAuthenticated(true);
    setUserId(newUserId);
    setIsDecoyMode(isDecoy);
    setSessionToken(newSessionToken);
    setSessionExpiresAt(expiry);
    
    // Log security event
    logSecurityEvent(newUserId, isDecoy ? 'login_decoy' : 'login_success', {});
  }, []);

  const extendSession = useCallback(() => {
    if (!userId) return;
    
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    
    sessionStorage.setItem('vault_session_expiry', expiry.toISOString());
    setSessionExpiresAt(expiry);
  }, [userId]);

  const logout = useCallback(async () => {
    const currentToken = sessionToken;
    const currentUserId = userId;
    
    // Log security event before clearing state
    if (currentUserId) {
      logSecurityEvent(currentUserId, 'logout', {});
    }
    
    // Invalidate session on server
    if (currentToken) {
      try {
        await supabase.functions.invoke('verify-pin', {
          body: { action: 'logout', sessionToken: currentToken }
        });
      } catch (error) {
        console.error('Error invalidating session:', error);
      }
    }
    
    // Clear local state
    sessionStorage.removeItem('vault_user_id');
    sessionStorage.removeItem('vault_session_token');
    sessionStorage.removeItem('vault_session_expiry');
    sessionStorage.removeItem('vault_decoy_mode');
    
    setIsAuthenticated(false);
    setUserId(null);
    setIsDecoyMode(false);
    setSessionToken(null);
    setSessionExpiresAt(null);
  }, [sessionToken, userId]);

  // Create an authenticated Supabase client with session token in headers
  const supabaseClient = useMemo(() => {
    return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: {
        headers: sessionToken ? { 'x-session-token': sessionToken } : {}
      },
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      }
    });
  }, [sessionToken]);

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      isAuthLoading, 
      userId, 
      isDecoyMode, 
      sessionToken,
      supabaseClient,
      login, 
      logout, 
      extendSession, 
      sessionExpiresAt 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
