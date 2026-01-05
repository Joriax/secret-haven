import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: {
    types: string[];
    tags: string[];
    dateRange: 'all' | 'today' | 'week' | 'month' | 'year';
  };
  createdAt: string;
}

export function useSavedSearches() {
  const { userId } = useAuth();
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    if (!userId) return;
    
    const stored = localStorage.getItem(`saved-searches-${userId}`);
    if (stored) {
      try {
        setSavedSearches(JSON.parse(stored));
      } catch {
        setSavedSearches([]);
      }
    }
  }, [userId]);

  const saveSearch = (name: string, query: string, filters: SavedSearch['filters']) => {
    if (!userId) return;
    
    const newSearch: SavedSearch = {
      id: crypto.randomUUID(),
      name,
      query,
      filters,
      createdAt: new Date().toISOString(),
    };
    
    const updated = [...savedSearches, newSearch];
    setSavedSearches(updated);
    localStorage.setItem(`saved-searches-${userId}`, JSON.stringify(updated));
    return newSearch;
  };

  const deleteSearch = (id: string) => {
    if (!userId) return;
    
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    localStorage.setItem(`saved-searches-${userId}`, JSON.stringify(updated));
  };

  const updateSearch = (id: string, updates: Partial<Omit<SavedSearch, 'id' | 'createdAt'>>) => {
    if (!userId) return;
    
    const updated = savedSearches.map(s => 
      s.id === id ? { ...s, ...updates } : s
    );
    setSavedSearches(updated);
    localStorage.setItem(`saved-searches-${userId}`, JSON.stringify(updated));
  };

  return {
    savedSearches,
    saveSearch,
    deleteSearch,
    updateSearch,
  };
}
