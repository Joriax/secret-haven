import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { GlobalSearch } from '../GlobalSearch';
import { PullToRefreshIndicator } from '../PullToRefreshIndicator';
import { VoiceCommandButton } from '../VoiceCommandButton';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useAuth } from '@/contexts/AuthContext';

export const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    // Trigger a page reload or data refetch
    window.location.reload();
  }, []);

  const { pullDistance, isRefreshing, isPulling, containerProps } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    maxPull: 150,
  });

  // Close sidebar and search when route changes to prevent blur overlay persisting
  useEffect(() => {
    setSidebarOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  // Cmd+K shortcut for global search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Skip link for keyboard navigation */}
      <a 
        href="#main-content" 
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById('main-content');
          if (main) {
            main.focus();
            main.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      >
        Zum Hauptinhalt springen
      </a>

      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)} 
        onSearchOpen={() => setSearchOpen(true)}
      />
      
      <main 
        id="main-content"
        className="flex-1 min-h-screen lg:ml-0 overflow-x-hidden bg-gradient-subtle relative"
        tabIndex={-1}
        role="main"
        aria-label="Hauptinhalt"
        {...containerProps}
      >
        {/* Pull-to-refresh indicator */}
        <PullToRefreshIndicator 
          pullDistance={pullDistance} 
          isRefreshing={isRefreshing} 
          isPulling={isPulling}
          threshold={80}
        />
        
        <div 
          className="p-4 lg:p-6 pt-16 lg:pt-6"
          style={{
            transform: isPulling || isRefreshing ? `translateY(${pullDistance}px)` : 'none',
            transition: isPulling ? 'none' : 'transform 0.3s ease-out',
          }}
        >
          <Outlet />
        </div>
      </main>

      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      
      {/* Voice Command Button */}
      <VoiceCommandButton />
    </div>
  );
};