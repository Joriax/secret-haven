import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useVaultData() {
  const { sessionToken } = useAuth();

  const callVaultData = useCallback(async (action: string, data?: any) => {
    if (!sessionToken) {
      throw new Error('Nicht authentifiziert');
    }

    const { data: response, error } = await supabase.functions.invoke('vault-data', {
      body: { action, sessionToken, data }
    });

    if (error) throw error;
    if (!response?.success) throw new Error(response?.error || 'Unbekannter Fehler');

    return response;
  }, [sessionToken]);

  // Notes
  const getNotes = useCallback((folderId?: string, includeDeleted = false) => 
    callVaultData('get-notes', { folderId, includeDeleted }), [callVaultData]);

  const createNote = useCallback((noteData: any) => 
    callVaultData('create-note', noteData), [callVaultData]);

  const updateNote = useCallback((id: string, updates: any) => 
    callVaultData('update-note', { id, updates }), [callVaultData]);

  const deleteNote = useCallback((id: string, permanent = false) => 
    callVaultData('delete-note', { id, permanent }), [callVaultData]);

  // Photos
  const getPhotos = useCallback((albumId?: string, includeDeleted = false) => 
    callVaultData('get-photos', { albumId, includeDeleted }), [callVaultData]);

  const deletePhoto = useCallback((id: string, permanent = false) => 
    callVaultData('delete-photo', { id, permanent }), [callVaultData]);

  // Files
  const getFiles = useCallback((albumId?: string, includeDeleted = false) => 
    callVaultData('get-files', { albumId, includeDeleted }), [callVaultData]);

  const deleteFile = useCallback((id: string, permanent = false) => 
    callVaultData('delete-file', { id, permanent }), [callVaultData]);

  // Links
  const getLinks = useCallback((folderId?: string, includeDeleted = false) => 
    callVaultData('get-links', { folderId, includeDeleted }), [callVaultData]);

  // TikToks
  const getTikToks = useCallback((folderId?: string, includeDeleted = false) => 
    callVaultData('get-tiktoks', { folderId, includeDeleted }), [callVaultData]);

  // Secret Texts
  const getSecretTexts = useCallback(() => 
    callVaultData('get-secret-texts'), [callVaultData]);

  // Security Logs
  const getSecurityLogs = useCallback((limit = 100) => 
    callVaultData('get-security-logs', { limit }), [callVaultData]);

  // Session History
  const getSessionHistory = useCallback(() => 
    callVaultData('get-session-history'), [callVaultData]);

  // View History
  const getViewHistory = useCallback(() => 
    callVaultData('get-view-history'), [callVaultData]);

  const recordView = useCallback((itemType: string, itemId: string) => 
    callVaultData('record-view', { itemType, itemId }), [callVaultData]);

  // Folders
  const getNoteFolders = useCallback(() => 
    callVaultData('get-note-folders'), [callVaultData]);

  const getAlbums = useCallback(() => 
    callVaultData('get-albums'), [callVaultData]);

  const getFileAlbums = useCallback(() => 
    callVaultData('get-file-albums'), [callVaultData]);

  // Trash
  const getTrash = useCallback(() => 
    callVaultData('get-trash'), [callVaultData]);

  const restoreItem = useCallback((itemType: string, itemId: string) => 
    callVaultData('restore-item', { itemType, itemId }), [callVaultData]);

  const emptyTrash = useCallback(() => 
    callVaultData('empty-trash'), [callVaultData]);

  return {
    callVaultData,
    getNotes,
    createNote,
    updateNote,
    deleteNote,
    getPhotos,
    deletePhoto,
    getFiles,
    deleteFile,
    getLinks,
    getTikToks,
    getSecretTexts,
    getSecurityLogs,
    getSessionHistory,
    getViewHistory,
    recordView,
    getNoteFolders,
    getAlbums,
    getFileAlbums,
    getTrash,
    restoreItem,
    emptyTrash,
  };
}
