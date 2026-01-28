import { useRef, useCallback, TouchEvent, MouseEvent } from 'react';

interface SwipeConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // Minimum distance for swipe
  preventScrollOnSwipe?: boolean;
}

interface SwipeHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
  onMouseDown: (e: MouseEvent) => void;
  onMouseMove: (e: MouseEvent) => void;
  onMouseUp: (e: MouseEvent) => void;
}

interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isSwiping: boolean;
}

export function useSwipeGestures(config: SwipeConfig): SwipeHandlers & { swipeProgress: number; swipeDirection: 'left' | 'right' | 'up' | 'down' | null } {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    preventScrollOnSwipe = false,
  } = config;

  const stateRef = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isSwiping: false,
  });

  const swipeProgressRef = useRef(0);
  const swipeDirectionRef = useRef<'left' | 'right' | 'up' | 'down' | null>(null);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    stateRef.current = {
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
      isSwiping: true,
    };
    swipeProgressRef.current = 0;
    swipeDirectionRef.current = null;
  }, []);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!stateRef.current.isSwiping) return;

    stateRef.current.currentX = clientX;
    stateRef.current.currentY = clientY;

    const deltaX = clientX - stateRef.current.startX;
    const deltaY = clientY - stateRef.current.startY;

    // Determine primary direction
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > absY) {
      swipeDirectionRef.current = deltaX > 0 ? 'right' : 'left';
      swipeProgressRef.current = Math.min(absX / threshold, 1);
    } else {
      swipeDirectionRef.current = deltaY > 0 ? 'down' : 'up';
      swipeProgressRef.current = Math.min(absY / threshold, 1);
    }
  }, [threshold]);

  const handleEnd = useCallback(() => {
    if (!stateRef.current.isSwiping) return;

    const deltaX = stateRef.current.currentX - stateRef.current.startX;
    const deltaY = stateRef.current.currentY - stateRef.current.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Check if swipe distance exceeds threshold
    if (absX > threshold && absX > absY) {
      if (deltaX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    } else if (absY > threshold && absY > absX) {
      if (deltaY > 0) {
        onSwipeDown?.();
      } else {
        onSwipeUp?.();
      }
    }

    stateRef.current.isSwiping = false;
    swipeProgressRef.current = 0;
    swipeDirectionRef.current = null;
  }, [threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  const onTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  }, [handleStart]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
    
    if (preventScrollOnSwipe && stateRef.current.isSwiping) {
      e.preventDefault();
    }
  }, [handleMove, preventScrollOnSwipe]);

  const onTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const onMouseDown = useCallback((e: MouseEvent) => {
    handleStart(e.clientX, e.clientY);
  }, [handleStart]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  }, [handleMove]);

  const onMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    swipeProgress: swipeProgressRef.current,
    swipeDirection: swipeDirectionRef.current,
  };
}

// Hook for swipeable list items with visual feedback
interface SwipeableItemConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  threshold?: number;
}

export function useSwipeableItem(config: SwipeableItemConfig) {
  const {
    onSwipeLeft,
    onSwipeRight,
    threshold = 80,
  } = config;

  const elementRef = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isSwipingRef = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = 0;
    isSwipingRef.current = true;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (!isSwipingRef.current) return;
    
    const diff = e.touches[0].clientX - startXRef.current;
    currentXRef.current = diff;
    
    if (elementRef.current) {
      // Limit the swipe distance
      const clampedDiff = Math.max(-150, Math.min(150, diff));
      elementRef.current.style.transform = `translateX(${clampedDiff}px)`;
      elementRef.current.style.transition = 'none';
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isSwipingRef.current) return;
    isSwipingRef.current = false;
    
    const diff = currentXRef.current;
    
    if (elementRef.current) {
      elementRef.current.style.transition = 'transform 0.3s ease-out';
      elementRef.current.style.transform = 'translateX(0)';
    }
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    }
  }, [threshold, onSwipeLeft, onSwipeRight]);

  return {
    ref: elementRef,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}

export default useSwipeGestures;
