import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ShareLinkConfig {
  itemId: string;
  itemType: 'photo' | 'file' | 'album' | 'note' | 'link';
  expiresInHours: number;
  maxClicks: number | null;
  password: string | null;
}

interface TempShare {
  id: string;
  item_id: string;
  item_type: string;
  token: string;
  expires_at: string;
  max_clicks: number | null;
  click_count: number;
  created_at: string;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function useTempShares() {
  const { userId, supabaseClient: supabase } = useAuth();
  const [isCreating, setIsCreating] = useState(false);

  const createShareLink = useCallback(async (config: ShareLinkConfig): Promise<string | null> => {
    if (!userId) {
      toast.error('Nicht angemeldet');
      return null;
    }

    setIsCreating(true);

    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + config.expiresInHours);

      const passwordHash = config.password ? await hashPassword(config.password) : null;

      const { data, error } = await supabase
        .from('temp_shares')
        .insert({
          user_id: userId,
          item_id: config.itemId,
          item_type: config.itemType,
          expires_at: expiresAt.toISOString(),
          max_clicks: config.maxClicks,
          password_hash: passwordHash,
        })
        .select('token')
        .single();

      if (error) throw error;

      // Generate the share URL
      const baseUrl = window.location.origin;
      const shareUrl = `${baseUrl}/share/${data.token}`;

      return shareUrl;
    } catch (error) {
      console.error('Error creating share link:', error);
      toast.error('Fehler beim Erstellen des Links');
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [userId, supabase]);

  const getMyShares = useCallback(async (): Promise<TempShare[]> => {
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from('temp_shares')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching shares:', error);
      return [];
    }
  }, [userId, supabase]);

  const deleteShare = useCallback(async (shareId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('temp_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;
      toast.success('Link gelöscht');
      return true;
    } catch (error) {
      console.error('Error deleting share:', error);
      toast.error('Fehler beim Löschen');
      return false;
    }
  }, [supabase]);

  const cleanupExpired = useCallback(async (): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('temp_shares')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('Error cleaning up expired shares:', error);
      return 0;
    }
  }, [supabase]);

  return {
    createShareLink,
    getMyShares,
    deleteShare,
    cleanupExpired,
    isCreating,
  };
}