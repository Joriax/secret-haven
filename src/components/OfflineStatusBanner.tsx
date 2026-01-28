import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, Cloud, CloudOff, RefreshCw, X, Download, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { cn } from '@/lib/utils';

interface OfflineStatusBannerProps {
  className?: string;
}

export const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({ className }) => {
  const { isOnline, isSyncing, pendingCount, lastSyncTime, syncNow } = useOfflineSync();
  const [dismissed, setDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Track if we were offline and came back online
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setDismissed(false);
    }
  }, [isOnline]);

  // Auto-dismiss success message after 5 seconds
  useEffect(() => {
    if (isOnline && wasOffline && pendingCount === 0) {
      const timer = setTimeout(() => {
        setWasOffline(false);
        setDismissed(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline, pendingCount]);

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Nie';
    const diff = Date.now() - lastSyncTime.getTime();
    if (diff < 60000) return 'Gerade eben';
    if (diff < 3600000) return `Vor ${Math.floor(diff / 60000)} Min.`;
    if (diff < 86400000) return `Vor ${Math.floor(diff / 3600000)} Std.`;
    return new Date(lastSyncTime).toLocaleDateString('de-DE');
  };

  // Determine what to show
  const shouldShow = !dismissed && (!isOnline || pendingCount > 0 || (wasOffline && isOnline));

  if (!shouldShow) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className={cn(
          'fixed top-0 left-0 right-0 z-50 p-3',
          className
        )}
      >
        <div
          className={cn(
            'max-w-md mx-auto rounded-xl shadow-lg border backdrop-blur-sm p-4',
            !isOnline 
              ? 'bg-destructive/90 border-destructive text-destructive-foreground' 
              : pendingCount > 0
                ? 'bg-orange-500/90 border-orange-500 text-white'
                : 'bg-green-500/90 border-green-500 text-white'
          )}
        >
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="shrink-0">
              {isSyncing ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : !isOnline ? (
                <WifiOff className="w-5 h-5" />
              ) : pendingCount > 0 ? (
                <CloudOff className="w-5 h-5" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                {isSyncing 
                  ? 'Synchronisiere...' 
                  : !isOnline 
                    ? 'Offline-Modus aktiv' 
                    : pendingCount > 0
                      ? `${pendingCount} Änderung${pendingCount !== 1 ? 'en' : ''} ausstehend`
                      : 'Wieder online!'}
              </p>
              {!isOnline && (
                <p className="text-xs opacity-80">
                  Änderungen werden lokal gespeichert
                </p>
              )}
              {isOnline && pendingCount > 0 && !isSyncing && (
                <p className="text-xs opacity-80">
                  Letzte Sync: {formatLastSync()}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {isOnline && pendingCount > 0 && !isSyncing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={syncNow}
                  className="h-8 px-3 text-white hover:bg-white/20"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Sync
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDismissed(true)}
                className="h-8 w-8 text-white hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Expandable Details */}
          {!isOnline && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: showDetails ? 'auto' : 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-white/20 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <Download className="w-3 h-3" />
                  <span>Offline-Daten werden automatisch synchronisiert, sobald du wieder online bist.</span>
                </div>
                <p className="opacity-70">
                  Du kannst weiterhin neue Notizen erstellen und Änderungen vornehmen.
                </p>
              </div>
            </motion.div>
          )}

          {/* Toggle Details */}
          {!isOnline && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full mt-2 text-xs opacity-70 hover:opacity-100 transition-opacity"
            >
              {showDetails ? 'Weniger anzeigen' : 'Mehr erfahren'}
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Compact offline indicator for sidebar/header
 */
export const OfflineIndicatorCompact: React.FC<{ className?: string }> = ({ className }) => {
  const { isOnline, isSyncing, pendingCount } = useOfflineSync();

  if (isOnline && pendingCount === 0 && !isSyncing) return null;

  return (
    <div 
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
        !isOnline 
          ? 'bg-destructive/20 text-destructive' 
          : 'bg-orange-500/20 text-orange-500',
        className
      )}
    >
      {isSyncing ? (
        <>
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Sync...</span>
        </>
      ) : !isOnline ? (
        <>
          <WifiOff className="w-3 h-3" />
          <span>Offline</span>
        </>
      ) : (
        <>
          <CloudOff className="w-3 h-3" />
          <span>{pendingCount}</span>
        </>
      )}
    </div>
  );
};
