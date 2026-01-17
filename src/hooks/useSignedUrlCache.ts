import { useState, useCallback, useRef } from 'react';
import { SIGNED_URL_EXPIRY_SECONDS } from '@/config';

interface CachedUrl {
  url: string;
  expiresAt: number;
}

/**
 * Hook for caching signed URLs to avoid regenerating them on every render
 * URLs are cached with their expiration time and refreshed before they expire
 */
export function useSignedUrlCache() {
  const cacheRef = useRef<Map<string, CachedUrl>>(new Map());
  const [version, setVersion] = useState(0); // Force re-render when cache updates

  /**
   * Get a cached URL if valid, or null if expired/not cached
   */
  const getCachedUrl = useCallback((key: string): string | null => {
    const cached = cacheRef.current.get(key);
    if (!cached) return null;
    
    // Check if URL is still valid (with 5 minute buffer before expiration)
    const bufferMs = 5 * 60 * 1000;
    if (Date.now() + bufferMs >= cached.expiresAt) {
      cacheRef.current.delete(key);
      return null;
    }
    
    return cached.url;
  }, []);

  /**
   * Set a URL in the cache
   * @param key - Unique identifier (e.g., `${bucket}/${path}`)
   * @param url - The signed URL
   * @param expirySeconds - How long the URL is valid (default from config)
   */
  const setCachedUrl = useCallback((
    key: string, 
    url: string, 
    expirySeconds: number = SIGNED_URL_EXPIRY_SECONDS
  ) => {
    cacheRef.current.set(key, {
      url,
      expiresAt: Date.now() + (expirySeconds * 1000),
    });
    setVersion(v => v + 1);
  }, []);

  /**
   * Get or create a signed URL
   * @param key - Unique identifier
   * @param createUrl - Function to create the URL if not cached
   */
  const getOrCreateUrl = useCallback(async (
    key: string,
    createUrl: () => Promise<string | null>
  ): Promise<string | null> => {
    const cached = getCachedUrl(key);
    if (cached) return cached;
    
    const newUrl = await createUrl();
    if (newUrl) {
      setCachedUrl(key, newUrl);
    }
    return newUrl;
  }, [getCachedUrl, setCachedUrl]);

  /**
   * Clear a specific URL from cache
   */
  const clearUrl = useCallback((key: string) => {
    cacheRef.current.delete(key);
  }, []);

  /**
   * Clear all cached URLs
   */
  const clearAll = useCallback(() => {
    cacheRef.current.clear();
    setVersion(0);
  }, []);

  /**
   * Get cache statistics
   */
  const getStats = useCallback(() => {
    let valid = 0;
    let expired = 0;
    const now = Date.now();
    
    cacheRef.current.forEach(cached => {
      if (now < cached.expiresAt) {
        valid++;
      } else {
        expired++;
      }
    });
    
    return { valid, expired, total: cacheRef.current.size };
  }, []);

  return {
    getCachedUrl,
    setCachedUrl,
    getOrCreateUrl,
    clearUrl,
    clearAll,
    getStats,
    cacheVersion: version,
  };
}

/**
 * Global signed URL cache for use across components
 */
class GlobalUrlCache {
  private cache = new Map<string, CachedUrl>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // Cleanup expired URLs every 5 minutes
    if (typeof window !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }
  
  get(key: string): string | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const bufferMs = 5 * 60 * 1000;
    if (Date.now() + bufferMs >= cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.url;
  }
  
  set(key: string, url: string, expirySeconds: number = SIGNED_URL_EXPIRY_SECONDS) {
    this.cache.set(key, {
      url,
      expiresAt: Date.now() + (expirySeconds * 1000),
    });
  }
  
  async getOrCreate(key: string, createUrl: () => Promise<string | null>): Promise<string | null> {
    const cached = this.get(key);
    if (cached) return cached;
    
    const newUrl = await createUrl();
    if (newUrl) {
      this.set(key, newUrl);
    }
    return newUrl;
  }
  
  private cleanup() {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now >= cached.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
  
  clear() {
    this.cache.clear();
  }
  
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

export const globalUrlCache = new GlobalUrlCache();
