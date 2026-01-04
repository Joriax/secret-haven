-- First create the helper function
CREATE OR REPLACE FUNCTION public.get_session_user_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM vault_sessions 
  WHERE session_token = (
    (current_setting('request.headers'::text, true))::json ->> 'x-session-token'
  )
  AND expires_at > now()
  LIMIT 1;
$$;

-- ========== SHARED_ALBUM_ITEMS ==========
DROP POLICY IF EXISTS "Allow select shared album items" ON shared_album_items;
DROP POLICY IF EXISTS "Allow insert shared album items" ON shared_album_items;
DROP POLICY IF EXISTS "Allow update shared album items" ON shared_album_items;
DROP POLICY IF EXISTS "Allow delete shared album items" ON shared_album_items;
DROP POLICY IF EXISTS "Shared album items owner access" ON shared_album_items;

CREATE POLICY "Shared album items owner access" ON shared_album_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM shared_albums 
    WHERE shared_albums.id = shared_album_items.shared_album_id 
    AND shared_albums.owner_id = public.get_session_user_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shared_albums 
    WHERE shared_albums.id = shared_album_items.shared_album_id 
    AND shared_albums.owner_id = public.get_session_user_id()
  )
);

-- ========== SHARED_ALBUM_ACCESS ==========
DROP POLICY IF EXISTS "Allow all on shared_album_access" ON shared_album_access;
DROP POLICY IF EXISTS "Shared album access owner policy" ON shared_album_access;

CREATE POLICY "Shared album access owner policy" ON shared_album_access FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM shared_albums 
    WHERE shared_albums.id = shared_album_access.shared_album_id 
    AND shared_albums.owner_id = public.get_session_user_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shared_albums 
    WHERE shared_albums.id = shared_album_access.shared_album_id 
    AND shared_albums.owner_id = public.get_session_user_id()
  )
);

-- ========== SHARED_ALBUMS ==========
DROP POLICY IF EXISTS "Allow all on shared_albums" ON shared_albums;
DROP POLICY IF EXISTS "Shared albums owner access" ON shared_albums;

CREATE POLICY "Shared albums owner access" ON shared_albums FOR ALL
USING (owner_id = public.get_session_user_id())
WITH CHECK (owner_id = public.get_session_user_id());

-- ========== BREAK_ENTRIES ==========
DROP POLICY IF EXISTS "Users can view their own break entries" ON break_entries;
DROP POLICY IF EXISTS "Users can create their own break entries" ON break_entries;
DROP POLICY IF EXISTS "Users can update their own break entries" ON break_entries;
DROP POLICY IF EXISTS "Users can delete their own break entries" ON break_entries;
DROP POLICY IF EXISTS "Break entries session access" ON break_entries;

CREATE POLICY "Break entries session access" ON break_entries FOR ALL
USING (user_id = public.get_session_user_id())
WITH CHECK (user_id = public.get_session_user_id());

-- ========== BREAK_SETTINGS ==========
DROP POLICY IF EXISTS "Users can view their own break settings" ON break_settings;
DROP POLICY IF EXISTS "Users can create their own break settings" ON break_settings;
DROP POLICY IF EXISTS "Users can update their own break settings" ON break_settings;
DROP POLICY IF EXISTS "Break settings session access" ON break_settings;

CREATE POLICY "Break settings session access" ON break_settings FOR ALL
USING (user_id = public.get_session_user_id())
WITH CHECK (user_id = public.get_session_user_id());

-- ========== SECURITY_LOGS ==========
DROP POLICY IF EXISTS "Users can view security logs" ON security_logs;
DROP POLICY IF EXISTS "Security logs session access" ON security_logs;

CREATE POLICY "Security logs session access" ON security_logs FOR SELECT
USING (user_id = public.get_session_user_id());

-- =====================================================
-- Storage bucket policies with user ownership validation
-- =====================================================

-- Drop existing permissive storage policies
DROP POLICY IF EXISTS "Users can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view note attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload note attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete note attachments" ON storage.objects;
DROP POLICY IF EXISTS "Photos owner select" ON storage.objects;
DROP POLICY IF EXISTS "Photos owner insert" ON storage.objects;
DROP POLICY IF EXISTS "Photos owner delete" ON storage.objects;
DROP POLICY IF EXISTS "Files owner select" ON storage.objects;
DROP POLICY IF EXISTS "Files owner insert" ON storage.objects;
DROP POLICY IF EXISTS "Files owner delete" ON storage.objects;
DROP POLICY IF EXISTS "Note attachments owner select" ON storage.objects;
DROP POLICY IF EXISTS "Note attachments owner insert" ON storage.objects;
DROP POLICY IF EXISTS "Note attachments owner delete" ON storage.objects;

-- Photos bucket: validate user owns the folder
CREATE POLICY "Photos owner select" ON storage.objects FOR SELECT
USING (
  bucket_id = 'photos' AND 
  (storage.foldername(name))[1] = public.get_session_user_id()::text
);

CREATE POLICY "Photos owner insert" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos' AND 
  (storage.foldername(name))[1] = public.get_session_user_id()::text
);

CREATE POLICY "Photos owner delete" ON storage.objects FOR DELETE
USING (
  bucket_id = 'photos' AND 
  (storage.foldername(name))[1] = public.get_session_user_id()::text
);

-- Files bucket: validate user owns the folder
CREATE POLICY "Files owner select" ON storage.objects FOR SELECT
USING (
  bucket_id = 'files' AND 
  (storage.foldername(name))[1] = public.get_session_user_id()::text
);

CREATE POLICY "Files owner insert" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'files' AND 
  (storage.foldername(name))[1] = public.get_session_user_id()::text
);

CREATE POLICY "Files owner delete" ON storage.objects FOR DELETE
USING (
  bucket_id = 'files' AND 
  (storage.foldername(name))[1] = public.get_session_user_id()::text
);

-- Note-attachments bucket: validate user owns the folder
CREATE POLICY "Note attachments owner select" ON storage.objects FOR SELECT
USING (
  bucket_id = 'note-attachments' AND 
  (storage.foldername(name))[1] = public.get_session_user_id()::text
);

CREATE POLICY "Note attachments owner insert" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'note-attachments' AND 
  (storage.foldername(name))[1] = public.get_session_user_id()::text
);

CREATE POLICY "Note attachments owner delete" ON storage.objects FOR DELETE
USING (
  bucket_id = 'note-attachments' AND 
  (storage.foldername(name))[1] = public.get_session_user_id()::text
);