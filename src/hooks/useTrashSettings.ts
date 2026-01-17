import { useState, useEffect, useCallback } from 'react';
import { TRASH_RETENTION_DAYS } from '@/config';

const TRASH_RETENTION_KEY = 'vault_trash_retention_days';

export function useTrashSettings() {
  const [retentionDays, setRetentionDays] = useState<number>(TRASH_RETENTION_DAYS);

  useEffect(() => {
    const stored = localStorage.getItem(TRASH_RETENTION_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 365) {
        setRetentionDays(parsed);
      }
    }
  }, []);

  const updateRetentionDays = useCallback((days: number) => {
    const validDays = Math.max(1, Math.min(365, days));
    setRetentionDays(validDays);
    localStorage.setItem(TRASH_RETENTION_KEY, validDays.toString());
  }, []);

  return {
    retentionDays,
    updateRetentionDays,
  };
}
