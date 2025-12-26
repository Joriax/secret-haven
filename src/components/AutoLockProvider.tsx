import React, { useEffect } from 'react';
import { useAutoLock } from '@/hooks/useAutoLock';
import { useAuth } from '@/contexts/AuthContext';

interface AutoLockProviderProps {
  children: React.ReactNode;
}

export const AutoLockProvider: React.FC<AutoLockProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  // Initialize the auto-lock hook
  useAutoLock();

  return <>{children}</>;
};
