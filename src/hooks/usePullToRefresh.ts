import { useRef, useCallback, useState, useEffect } from 'react';

interface PullToRefreshConfig {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
  disabled?: boolean;
}

interface PullToRefreshReturn {
  pullDistance: number;
  isRefreshing: boolean;
  isPulling: boolean;
  containerProps: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  indicatorStyle: React.CSSProperties;
}

export function usePullToRefresh(config: PullToRefreshConfig): PullToRefreshReturn {
  const { onRefresh, threshold = 80, maxPull = 150, disabled = false } = config;

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const isTrackingRef = useRef(false);
  const isPullingRef = useRef(false);
  const hasStartedPullRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    if (e.touches.length !== 1) return;
    
    // Only enable pull if at top of scroll (window OR scroll container)
    const target = e.currentTarget as HTMLElement;
    const windowScrollTop =
      window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const containerScrollTop = target.scrollTop || 0;
    const atTop = windowScrollTop <= 0 && containerScrollTop <= 0;
    if (!atTop) return;

    startYRef.current = e.touches[0].clientY;
    currentYRef.current = startYRef.current;

    // Track gesture, but don't mark as pulling yet.
    // Marking as pulling on touchstart causes layout/style updates that can cancel clicks on iOS.
    isTrackingRef.current = true;
    isPullingRef.current = false;
    hasStartedPullRef.current = false;
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isTrackingRef.current || disabled || isRefreshing) return;
    if (e.touches.length !== 1) return;

    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;

    // Small dead-zone so normal taps don't trigger pull state.
    const deadZonePx = 6;

    if (diff > deadZonePx) {
      if (!hasStartedPullRef.current) {
        hasStartedPullRef.current = true;
        isPullingRef.current = true;
        setIsPulling(true);
      }
      // Apply resistance to pull
      const resistance = 0.5;
      const distance = Math.min(diff * resistance, maxPull);
      setPullDistance(distance);
    } else if (!hasStartedPullRef.current) {
      // Keep distance at 0 during the dead-zone to avoid layout updates during taps.
      if (pullDistance !== 0) setPullDistance(0);
    }
  }, [disabled, isRefreshing, maxPull, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isTrackingRef.current || disabled) return;
    
    isTrackingRef.current = false;

    const didPull = hasStartedPullRef.current;
    hasStartedPullRef.current = false;
    isPullingRef.current = false;
    if (didPull) setIsPulling(false);

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold); // Keep at threshold during refresh
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [disabled, pullDistance, threshold, isRefreshing, onRefresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isTrackingRef.current = false;
      isPullingRef.current = false;
      hasStartedPullRef.current = false;
    };
  }, []);

  const indicatorStyle: React.CSSProperties = {
    transform: `translateY(${pullDistance}px)`,
    transition: isPulling ? 'none' : 'transform 0.3s ease-out',
  };

  return {
    pullDistance,
    isRefreshing,
    isPulling,
    containerProps: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    indicatorStyle,
  };
}

export default usePullToRefresh;
