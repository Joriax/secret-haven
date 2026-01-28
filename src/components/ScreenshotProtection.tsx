import React, { useEffect } from 'react';
import { useUserPreferences } from '@/hooks/useUserPreferences';

export const ScreenshotProtection: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { preferences } = useUserPreferences();

  useEffect(() => {
    if (!preferences?.screenshot_protection) return;

    const root = document.documentElement;
    
    // Add CSS protection
    root.style.setProperty('-webkit-user-select', 'none');
    root.style.setProperty('user-select', 'none');
    
    // Prevent right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Detect screenshot attempts (PrintScreen key)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        // Could show a warning or temporarily hide content
        document.body.classList.add('screenshot-blur');
        setTimeout(() => {
          document.body.classList.remove('screenshot-blur');
        }, 500);
      }
    };

    // Detect visibility change (could indicate screen recording)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // User switched away - could log this
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Add blur CSS for screenshot protection
    const style = document.createElement('style');
    style.id = 'screenshot-protection-styles';
    style.textContent = `
      .screenshot-blur * {
        filter: blur(20px) !important;
        transition: filter 0.1s ease;
      }
      
      @media print {
        body * {
          display: none !important;
        }
        body::after {
          content: 'Drucken ist deaktiviert';
          display: block;
          text-align: center;
          padding: 2rem;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      root.style.removeProperty('-webkit-user-select');
      root.style.removeProperty('user-select');
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.getElementById('screenshot-protection-styles')?.remove();
    };
  }, [preferences?.screenshot_protection]);

  return <>{children}</>;
};

export default ScreenshotProtection;
