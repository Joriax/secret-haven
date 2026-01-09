import React from 'react';
import { useRealtimeSync } from '@/contexts/RealtimeSyncContext';
import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SyncStatusIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  showDetails = false,
  className,
}) => {
  const { isOnline, isSyncing, pendingChanges, lastSyncTime, triggerSync } = useRealtimeSync();

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Nie';
    const diff = Date.now() - lastSyncTime.getTime();
    if (diff < 60000) return 'Gerade eben';
    if (diff < 3600000) return `Vor ${Math.floor(diff / 60000)} Min.`;
    return `Vor ${Math.floor(diff / 3600000)} Std.`;
  };

  const getStatusColor = () => {
    if (!isOnline) return 'text-destructive';
    if (isSyncing) return 'text-yellow-500';
    if (pendingChanges > 0) return 'text-orange-500';
    return 'text-green-500';
  };

  const StatusIcon = () => {
    if (isSyncing) {
      return <RefreshCw className={cn('h-4 w-4 animate-spin', getStatusColor())} />;
    }
    if (!isOnline) {
      return <WifiOff className={cn('h-4 w-4', getStatusColor())} />;
    }
    if (pendingChanges > 0) {
      return <CloudOff className={cn('h-4 w-4', getStatusColor())} />;
    }
    return <Cloud className={cn('h-4 w-4', getStatusColor())} />;
  };

  if (!showDetails) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('relative', className)}>
            <StatusIcon />
            {pendingChanges > 0 && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-orange-500 text-[8px] text-white flex items-center justify-center">
                {pendingChanges > 9 ? '9+' : pendingChanges}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {!isOnline 
              ? 'Offline - Änderungen werden gespeichert' 
              : isSyncing 
                ? 'Synchronisiere...' 
                : pendingChanges > 0 
                  ? `${pendingChanges} ausstehende Änderungen` 
                  : 'Alles synchronisiert'}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-lg bg-muted/50', className)}>
      <div className="flex items-center gap-2">
        <StatusIcon />
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {!isOnline ? 'Offline' : isSyncing ? 'Synchronisiere...' : 'Online'}
          </span>
          <span className="text-xs text-muted-foreground">
            Letzte Sync: {formatLastSync()}
          </span>
        </div>
      </div>
      
      {pendingChanges > 0 && (
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-orange-500">
            {pendingChanges} ausstehend
          </span>
          {isOnline && !isSyncing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => triggerSync()}
              className="h-7 px-2"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Sync
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
