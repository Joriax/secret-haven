import React, { memo, useCallback, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Star, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';

interface SwipeableListItemProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: {
    icon: React.ReactNode;
    color: string;
    label?: string;
  };
  rightAction?: {
    icon: React.ReactNode;
    color: string;
    label?: string;
  };
  threshold?: number;
  className?: string;
  disabled?: boolean;
}

export const SwipeableListItem = memo(function SwipeableListItem({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction = { icon: <Star className="w-5 h-5" />, color: 'bg-yellow-500' },
  rightAction = { icon: <Trash2 className="w-5 h-5" />, color: 'bg-destructive' },
  threshold = 80,
  className,
  disabled = false,
}: SwipeableListItemProps) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const { vibrateLight, vibrateSuccess } = useHaptics();
  const hasVibratedRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = 0;
    setIsDragging(true);
    hasVibratedRef.current = false;
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || disabled) return;
    
    const diff = e.touches[0].clientX - startXRef.current;
    currentXRef.current = diff;
    
    // Limit swipe range
    const maxSwipe = 120;
    const clampedDiff = Math.max(-maxSwipe, Math.min(maxSwipe, diff));
    setOffset(clampedDiff);

    // Haptic feedback when passing threshold
    if (Math.abs(clampedDiff) >= threshold && !hasVibratedRef.current) {
      vibrateLight();
      hasVibratedRef.current = true;
    } else if (Math.abs(clampedDiff) < threshold) {
      hasVibratedRef.current = false;
    }
  }, [isDragging, disabled, threshold, vibrateLight]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || disabled) return;
    setIsDragging(false);
    
    const diff = currentXRef.current;
    
    if (Math.abs(diff) >= threshold) {
      vibrateSuccess();
      if (diff > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (diff < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }
    
    setOffset(0);
  }, [isDragging, disabled, threshold, onSwipeLeft, onSwipeRight, vibrateSuccess]);

  const showLeftAction = offset > 20;
  const showRightAction = offset < -20;
  const leftProgress = Math.min(offset / threshold, 1);
  const rightProgress = Math.min(-offset / threshold, 1);

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      {/* Left action background (swipe right) */}
      {onSwipeRight && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-start pl-4 transition-opacity",
            leftAction.color,
            showLeftAction ? "opacity-100" : "opacity-0"
          )}
          style={{ width: Math.max(offset, 0) }}
        >
          <motion.div
            animate={{ scale: leftProgress >= 1 ? 1.2 : 1 }}
            className="text-white"
          >
            {leftAction.icon}
          </motion.div>
        </div>
      )}

      {/* Right action background (swipe left) */}
      {onSwipeLeft && (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end pr-4 transition-opacity",
            rightAction.color,
            showRightAction ? "opacity-100" : "opacity-0"
          )}
          style={{ width: Math.max(-offset, 0) }}
        >
          <motion.div
            animate={{ scale: rightProgress >= 1 ? 1.2 : 1 }}
            className="text-white"
          >
            {rightAction.icon}
          </motion.div>
        </div>
      )}

      {/* Main content */}
      <motion.div
        animate={{ x: offset }}
        transition={{ type: 'spring', stiffness: 500, damping: 50, duration: isDragging ? 0 : 0.3 }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative bg-card touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
});

export default SwipeableListItem;
