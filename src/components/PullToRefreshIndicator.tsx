import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  threshold: number;
  isRefreshing: boolean;
  isPulling: boolean;
}

export const PullToRefreshIndicator = memo(function PullToRefreshIndicator({
  pullDistance,
  threshold,
  isRefreshing,
  isPulling,
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1);
  const isReady = progress >= 1;

  if (!isPulling && !isRefreshing && pullDistance === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ 
          opacity: pullDistance > 10 || isRefreshing ? 1 : 0, 
          y: Math.min(pullDistance - 40, threshold - 40),
        }}
        exit={{ opacity: 0, y: -40 }}
        className="absolute left-0 right-0 top-0 flex justify-center items-center z-50 pointer-events-none"
        style={{ height: 40 }}
      >
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors duration-200",
            isReady || isRefreshing
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground border border-border"
          )}
        >
          {isRefreshing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <motion.div
              animate={{ rotate: isReady ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ArrowDown className="w-5 h-5" />
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

export default PullToRefreshIndicator;
