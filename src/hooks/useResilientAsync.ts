import { useState, useCallback, useRef, useEffect } from 'react';

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Hook for resilient async operations with retry logic
 */
export function useResilientAsync<T>(
  asyncFn: () => Promise<T>,
  options: RetryOptions = {}
) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    // Abort any previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setRetryCount(0);

    let currentRetry = 0;
    let delay = initialDelay;

    while (currentRetry <= maxRetries) {
      try {
        const result = await asyncFn();
        setData(result);
        setError(null);
        setIsLoading(false);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        
        // Check if aborted
        if (error.name === 'AbortError') {
          setIsLoading(false);
          return null;
        }

        currentRetry++;
        setRetryCount(currentRetry);

        if (currentRetry > maxRetries || !shouldRetry(error)) {
          setError(error);
          setIsLoading(false);
          throw error;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }

    setIsLoading(false);
    return null;
  }, [asyncFn, maxRetries, initialDelay, maxDelay, backoffMultiplier, shouldRetry]);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setData(null);
    setError(null);
    setIsLoading(false);
    setRetryCount(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    data,
    error,
    isLoading,
    retryCount,
    execute,
    reset,
  };
}

/**
 * Hook for handling loading states with minimum display time
 * Prevents flash of loading state for fast operations
 */
export function useMinLoadingTime(minTime: number = 300) {
  const [isLoading, setIsLoading] = useState(false);
  const startTimeRef = useRef<number | null>(null);

  const start = useCallback(() => {
    startTimeRef.current = Date.now();
    setIsLoading(true);
  }, []);

  const stop = useCallback(async () => {
    if (startTimeRef.current === null) {
      setIsLoading(false);
      return;
    }

    const elapsed = Date.now() - startTimeRef.current;
    const remaining = minTime - elapsed;

    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining));
    }

    setIsLoading(false);
    startTimeRef.current = null;
  }, [minTime]);

  return { isLoading, start, stop };
}

/**
 * Hook for optimistic updates
 */
export function useOptimisticUpdate<T>(
  initialValue: T,
  persistFn: (value: T) => Promise<void>
) {
  const [value, setValue] = useState<T>(initialValue);
  const [pendingValue, setPendingValue] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const update = useCallback(async (newValue: T) => {
    const previousValue = value;
    
    // Optimistically update
    setValue(newValue);
    setPendingValue(newValue);
    setIsUpdating(true);
    setError(null);

    try {
      await persistFn(newValue);
      setPendingValue(null);
    } catch (err) {
      // Rollback on error
      setValue(previousValue);
      setPendingValue(null);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, [value, persistFn]);

  return {
    value,
    pendingValue,
    error,
    isUpdating,
    update,
    isPending: pendingValue !== null,
  };
}

/**
 * Hook for debounced error recovery
 */
export function useErrorRecovery(recoveryFn: () => void, delay: number = 5000) {
  const [error, setError] = useState<Error | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const reportError = useCallback((err: Error) => {
    setError(err);
    
    // Auto-recover after delay
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsRecovering(true);
      try {
        recoveryFn();
        setError(null);
      } finally {
        setIsRecovering(false);
      }
    }, delay);
  }, [recoveryFn, delay]);

  const clearError = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setError(null);
    setIsRecovering(false);
  }, []);

  const manualRecover = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsRecovering(true);
    try {
      recoveryFn();
      setError(null);
    } finally {
      setIsRecovering(false);
    }
  }, [recoveryFn]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    error,
    isRecovering,
    reportError,
    clearError,
    manualRecover,
  };
}
