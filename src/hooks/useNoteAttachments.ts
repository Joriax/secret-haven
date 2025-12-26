import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface NoteAttachment {
  id: string;
  note_id: string;
  user_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  created_at: string;
  url?: string;
}

export function useNoteAttachments(noteId: string | null) {
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { userId } = useAuth();

  const fetchAttachments = useCallback(async () => {
    if (!noteId || !userId) {
      setAttachments([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('note_attachments')
        .select('*')
        .eq('note_id', noteId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get signed URLs for each attachment
      const attachmentsWithUrls = await Promise.all(
        (data || []).map(async (att) => {
          const { data: urlData } = await supabase.storage
            .from('note-attachments')
            .createSignedUrl(`${userId}/${att.filename}`, 3600);
          return { ...att, url: urlData?.signedUrl };
        })
      );

      setAttachments(attachmentsWithUrls);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [noteId, userId]);

  const uploadAttachment = async (file: File) => {
    if (!noteId || !userId) return null;

    setIsUploading(true);
    try {
      const filename = `${Date.now()}-${file.name}`;
      const filePath = `${userId}/${filename}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('note-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create database record
      const { data, error: dbError } = await supabase
        .from('note_attachments')
        .insert({
          note_id: noteId,
          user_id: userId,
          filename,
          original_name: file.name,
          mime_type: file.type,
          size: file.size,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Get signed URL
      const { data: urlData } = await supabase.storage
        .from('note-attachments')
        .createSignedUrl(filePath, 3600);

      const newAttachment = { ...data, url: urlData?.signedUrl };
      setAttachments(prev => [newAttachment, ...prev]);
      toast.success('Anhang hochgeladen');
      return newAttachment;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      toast.error('Fehler beim Hochladen');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const deleteAttachment = async (attachment: NoteAttachment) => {
    if (!userId) return false;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('note-attachments')
        .remove([`${userId}/${attachment.filename}`]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('note_attachments')
        .delete()
        .eq('id', attachment.id);

      if (dbError) throw dbError;

      setAttachments(prev => prev.filter(a => a.id !== attachment.id));
      toast.success('Anhang gelöscht');
      return true;
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast.error('Fehler beim Löschen');
      return false;
    }
  };

  return {
    attachments,
    isLoading,
    isUploading,
    fetchAttachments,
    uploadAttachment,
    deleteAttachment,
  };
}
