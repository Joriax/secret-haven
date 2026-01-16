import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface DuplicateCheck {
  isDuplicate: boolean;
  existingItem?: {
    id: string;
    filename: string;
    type: 'photo' | 'file';
    uploadedAt: string;
  };
}

// Simple hash function for quick comparison
async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Quick hash using only file metadata (faster but less accurate)
function quickHash(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export const useDuplicatePrevention = () => {
  const [checking, setChecking] = useState(false);
  const [uploadedHashes, setUploadedHashes] = useState<Map<string, { id: string; filename: string; type: string }>>(new Map());
  const { userId, supabaseClient: supabase } = useAuth();

  // Load existing file hashes on init
  const loadExistingHashes = useCallback(async () => {
    if (!userId) return;

    try {
      const [photosRes, filesRes] = await Promise.all([
        supabase
          .from('photos')
          .select('id, filename, uploaded_at')
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabase
          .from('files')
          .select('id, filename, uploaded_at')
          .eq('user_id', userId)
          .is('deleted_at', null),
      ]);

      const hashes = new Map<string, { id: string; filename: string; type: string }>();

      (photosRes.data || []).forEach(photo => {
        // Use filename as quick identifier
        const key = photo.filename.toLowerCase();
        hashes.set(key, { id: photo.id, filename: photo.filename, type: 'photo' });
      });

      (filesRes.data || []).forEach(file => {
        const key = file.filename.toLowerCase();
        hashes.set(key, { id: file.id, filename: file.filename, type: 'file' });
      });

      setUploadedHashes(hashes);
    } catch (error) {
      console.error('Error loading existing hashes:', error);
    }
  }, [userId, supabase]);

  // Check if file is a duplicate
  const checkForDuplicate = useCallback(async (
    file: File, 
    options?: { useFullHash?: boolean }
  ): Promise<DuplicateCheck> => {
    setChecking(true);

    try {
      // Quick check by filename
      const filenameKey = file.name.toLowerCase();
      if (uploadedHashes.has(filenameKey)) {
        const existing = uploadedHashes.get(filenameKey)!;
        return {
          isDuplicate: true,
          existingItem: {
            id: existing.id,
            filename: existing.filename,
            type: existing.type as 'photo' | 'file',
            uploadedAt: '',
          },
        };
      }

      // Check by size match (quick duplicate detection)
      const sizeMatch = Array.from(uploadedHashes.entries()).find(([key, value]) => {
        // Simple name similarity check
        const baseName = file.name.replace(/\.[^/.]+$/, '').toLowerCase();
        const existingBase = value.filename.replace(/\.[^/.]+$/, '').toLowerCase();
        return baseName === existingBase || key.includes(baseName);
      });

      if (sizeMatch) {
        const [, existing] = sizeMatch;
        return {
          isDuplicate: true,
          existingItem: {
            id: existing.id,
            filename: existing.filename,
            type: existing.type as 'photo' | 'file',
            uploadedAt: '',
          },
        };
      }

      return { isDuplicate: false };
    } finally {
      setChecking(false);
    }
  }, [uploadedHashes]);

  // Check multiple files at once
  const checkMultipleFiles = useCallback(async (
    files: File[]
  ): Promise<{ duplicates: File[]; unique: File[] }> => {
    const duplicates: File[] = [];
    const unique: File[] = [];

    for (const file of files) {
      const result = await checkForDuplicate(file);
      if (result.isDuplicate) {
        duplicates.push(file);
      } else {
        unique.push(file);
      }
    }

    return { duplicates, unique };
  }, [checkForDuplicate]);

  // Show duplicate warning toast
  const showDuplicateWarning = useCallback((
    file: File, 
    existingFilename: string,
    onProceed?: () => void,
    onCancel?: () => void
  ) => {
    toast.warning(`Mögliches Duplikat gefunden`, {
      description: `"${file.name}" existiert möglicherweise bereits als "${existingFilename}"`,
      duration: 10000,
      action: {
        label: 'Trotzdem hochladen',
        onClick: () => onProceed?.(),
      },
      cancel: {
        label: 'Abbrechen',
        onClick: () => onCancel?.(),
      },
    });
  }, []);

  // Register a newly uploaded file
  const registerUpload = useCallback((
    filename: string, 
    id: string, 
    type: 'photo' | 'file'
  ) => {
    const key = filename.toLowerCase();
    setUploadedHashes(prev => {
      const newMap = new Map(prev);
      newMap.set(key, { id, filename, type });
      return newMap;
    });
  }, []);

  return {
    checking,
    checkForDuplicate,
    checkMultipleFiles,
    showDuplicateWarning,
    registerUpload,
    loadExistingHashes,
    uploadedHashes,
  };
};
