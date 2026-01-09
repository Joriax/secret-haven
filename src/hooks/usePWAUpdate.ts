import { useState, useEffect, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const usePWAUpdate = () => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log('SW registered:', swUrl);
      
      // Check for updates every 60 seconds
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setShowUpdatePrompt(true);
    }
  }, [needRefresh]);

  const updateApp = useCallback(async () => {
    await updateServiceWorker(true);
    setShowUpdatePrompt(false);
    setNeedRefresh(false);
  }, [updateServiceWorker, setNeedRefresh]);

  const dismissUpdate = useCallback(() => {
    setShowUpdatePrompt(false);
  }, []);

  return {
    showUpdatePrompt,
    updateApp,
    dismissUpdate,
    needRefresh,
  };
};
