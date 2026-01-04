-- Fix RLS policies to use proper ownership checks with get_session_user_id()
-- Drop and recreate all policies that use USING(true) or WITH CHECK(true)

-- NOTES table
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;

CREATE POLICY "Users can view their own notes" ON public.notes FOR SELECT USING (user_id = get_session_user_id());
CREATE POLICY "Users can create notes" ON public.notes FOR INSERT WITH CHECK (user_id = get_session_user_id());
CREATE POLICY "Users can update their own notes" ON public.notes FOR UPDATE USING (user_id = get_session_user_id());
CREATE POLICY "Users can delete their own notes" ON public.notes FOR DELETE USING (user_id = get_session_user_id());

-- ALBUMS table
DROP POLICY IF EXISTS "Users can view their own albums" ON public.albums;
DROP POLICY IF EXISTS "Users can create albums" ON public.albums;
DROP POLICY IF EXISTS "Users can update their own albums" ON public.albums;
DROP POLICY IF EXISTS "Users can delete their own albums" ON public.albums;

CREATE POLICY "Users can view their own albums" ON public.albums FOR SELECT USING (user_id = get_session_user_id());
CREATE POLICY "Users can create albums" ON public.albums FOR INSERT WITH CHECK (user_id = get_session_user_id());
CREATE POLICY "Users can update their own albums" ON public.albums FOR UPDATE USING (user_id = get_session_user_id());
CREATE POLICY "Users can delete their own albums" ON public.albums FOR DELETE USING (user_id = get_session_user_id());

-- PHOTOS table
DROP POLICY IF EXISTS "Users can view their own photos" ON public.photos;
DROP POLICY IF EXISTS "Users can create photos" ON public.photos;
DROP POLICY IF EXISTS "Users can update their own photos" ON public.photos;
DROP POLICY IF EXISTS "Users can delete their own photos" ON public.photos;

CREATE POLICY "Users can view their own photos" ON public.photos FOR SELECT USING (user_id = get_session_user_id());
CREATE POLICY "Users can create photos" ON public.photos FOR INSERT WITH CHECK (user_id = get_session_user_id());
CREATE POLICY "Users can update their own photos" ON public.photos FOR UPDATE USING (user_id = get_session_user_id());
CREATE POLICY "Users can delete their own photos" ON public.photos FOR DELETE USING (user_id = get_session_user_id());

-- TAGS table
DROP POLICY IF EXISTS "Users can view their own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can create tags" ON public.tags;
DROP POLICY IF EXISTS "Users can update their own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can delete their own tags" ON public.tags;

CREATE POLICY "Users can view their own tags" ON public.tags FOR SELECT USING (user_id = get_session_user_id());
CREATE POLICY "Users can create tags" ON public.tags FOR INSERT WITH CHECK (user_id = get_session_user_id());
CREATE POLICY "Users can update their own tags" ON public.tags FOR UPDATE USING (user_id = get_session_user_id());
CREATE POLICY "Users can delete their own tags" ON public.tags FOR DELETE USING (user_id = get_session_user_id());

-- NOTE_VERSIONS table
DROP POLICY IF EXISTS "Users can view their own note versions" ON public.note_versions;
DROP POLICY IF EXISTS "Users can create note versions" ON public.note_versions;

CREATE POLICY "Users can view their own note versions" ON public.note_versions FOR SELECT USING (user_id = get_session_user_id());
CREATE POLICY "Users can create note versions" ON public.note_versions FOR INSERT WITH CHECK (user_id = get_session_user_id());

-- VIEW_HISTORY table
DROP POLICY IF EXISTS "Users can view their own history" ON public.view_history;
DROP POLICY IF EXISTS "Users can create history" ON public.view_history;
DROP POLICY IF EXISTS "Users can delete their own history" ON public.view_history;

CREATE POLICY "Users can view their own history" ON public.view_history FOR SELECT USING (user_id = get_session_user_id());
CREATE POLICY "Users can create history" ON public.view_history FOR INSERT WITH CHECK (user_id = get_session_user_id());
CREATE POLICY "Users can delete their own history" ON public.view_history FOR DELETE USING (user_id = get_session_user_id());

-- SECRET_TEXTS table
DROP POLICY IF EXISTS "Users can view their own secret texts" ON public.secret_texts;
DROP POLICY IF EXISTS "Users can create secret texts" ON public.secret_texts;
DROP POLICY IF EXISTS "Users can update their own secret texts" ON public.secret_texts;
DROP POLICY IF EXISTS "Users can delete their own secret texts" ON public.secret_texts;

CREATE POLICY "Users can view their own secret texts" ON public.secret_texts FOR SELECT USING (user_id = get_session_user_id());
CREATE POLICY "Users can create secret texts" ON public.secret_texts FOR INSERT WITH CHECK (user_id = get_session_user_id());
CREATE POLICY "Users can update their own secret texts" ON public.secret_texts FOR UPDATE USING (user_id = get_session_user_id());
CREATE POLICY "Users can delete their own secret texts" ON public.secret_texts FOR DELETE USING (user_id = get_session_user_id());

-- FILES table
DROP POLICY IF EXISTS "Users can view their own files" ON public.files;
DROP POLICY IF EXISTS "Users can create files" ON public.files;
DROP POLICY IF EXISTS "Users can update their own files" ON public.files;
DROP POLICY IF EXISTS "Users can delete their own files" ON public.files;

CREATE POLICY "Users can view their own files" ON public.files FOR SELECT USING (user_id = get_session_user_id());
CREATE POLICY "Users can create files" ON public.files FOR INSERT WITH CHECK (user_id = get_session_user_id());
CREATE POLICY "Users can update their own files" ON public.files FOR UPDATE USING (user_id = get_session_user_id());
CREATE POLICY "Users can delete their own files" ON public.files FOR DELETE USING (user_id = get_session_user_id());

-- NOTE_FOLDERS table
DROP POLICY IF EXISTS "Users can view their own folders" ON public.note_folders;
DROP POLICY IF EXISTS "Users can create folders" ON public.note_folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON public.note_folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON public.note_folders;

CREATE POLICY "Users can view their own folders" ON public.note_folders FOR SELECT USING (user_id = get_session_user_id());
CREATE POLICY "Users can create folders" ON public.note_folders FOR INSERT WITH CHECK (user_id = get_session_user_id());
CREATE POLICY "Users can update their own folders" ON public.note_folders FOR UPDATE USING (user_id = get_session_user_id());
CREATE POLICY "Users can delete their own folders" ON public.note_folders FOR DELETE USING (user_id = get_session_user_id());

-- LINKS table
DROP POLICY IF EXISTS "Users can view their own links" ON public.links;
DROP POLICY IF EXISTS "Users can create links" ON public.links;
DROP POLICY IF EXISTS "Users can update their own links" ON public.links;
DROP POLICY IF EXISTS "Users can delete their own links" ON public.links;

CREATE POLICY "Users can view their own links" ON public.links FOR SELECT USING (user_id = get_session_user_id());
CREATE POLICY "Users can create links" ON public.links FOR INSERT WITH CHECK (user_id = get_session_user_id());
CREATE POLICY "Users can update their own links" ON public.links FOR UPDATE USING (user_id = get_session_user_id());
CREATE POLICY "Users can delete their own links" ON public.links FOR DELETE USING (user_id = get_session_user_id());

-- NOTE_ATTACHMENTS table
DROP POLICY IF EXISTS "Users can view their own attachments" ON public.note_attachments;
DROP POLICY IF EXISTS "Users can create attachments" ON public.note_attachments;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON public.note_attachments;

CREATE POLICY "Users can view their own attachments" ON public.note_attachments FOR SELECT USING (user_id = get_session_user_id());
CREATE POLICY "Users can create attachments" ON public.note_attachments FOR INSERT WITH CHECK (user_id = get_session_user_id());
CREATE POLICY "Users can delete their own attachments" ON public.note_attachments FOR DELETE USING (user_id = get_session_user_id());

-- LINK_FOLDERS table
DROP POLICY IF EXISTS "Users can view their own link folders" ON public.link_folders;
DROP POLICY IF EXISTS "Users can create link folders" ON public.link_folders;
DROP POLICY IF EXISTS "Users can update their own link folders" ON public.link_folders;
DROP POLICY IF EXISTS "Users can delete their own link folders" ON public.link_folders;

CREATE POLICY "Users can view their own link folders" ON public.link_folders FOR SELECT USING (user_id = get_session_user_id());
CREATE POLICY "Users can create link folders" ON public.link_folders FOR INSERT WITH CHECK (user_id = get_session_user_id());
CREATE POLICY "Users can update their own link folders" ON public.link_folders FOR UPDATE USING (user_id = get_session_user_id());
CREATE POLICY "Users can delete their own link folders" ON public.link_folders FOR DELETE USING (user_id = get_session_user_id());

-- TIKTOK_VIDEOS table
DROP POLICY IF EXISTS "Users can view their own tiktok videos" ON public.tiktok_videos;
DROP POLICY IF EXISTS "Users can create tiktok videos" ON public.tiktok_videos;
DROP POLICY IF EXISTS "Users can update their own tiktok videos" ON public.tiktok_videos;
DROP POLICY IF EXISTS "Users can delete their own tiktok videos" ON public.tiktok_videos;

CREATE POLICY "Users can view their own tiktok videos" ON public.tiktok_videos FOR SELECT USING (user_id = get_session_user_id());
CREATE POLICY "Users can create tiktok videos" ON public.tiktok_videos FOR INSERT WITH CHECK (user_id = get_session_user_id());
CREATE POLICY "Users can update their own tiktok videos" ON public.tiktok_videos FOR UPDATE USING (user_id = get_session_user_id());
CREATE POLICY "Users can delete their own tiktok videos" ON public.tiktok_videos FOR DELETE USING (user_id = get_session_user_id());

-- TIKTOK_FOLDERS table
DROP POLICY IF EXISTS "Users can view their own tiktok folders" ON public.tiktok_folders;
DROP POLICY IF EXISTS "Users can create tiktok folders" ON public.tiktok_folders;
DROP POLICY IF EXISTS "Users can update their own tiktok folders" ON public.tiktok_folders;
DROP POLICY IF EXISTS "Users can delete their own tiktok folders" ON public.tiktok_folders;

CREATE POLICY "Users can view their own tiktok folders" ON public.tiktok_folders FOR SELECT USING (user_id = get_session_user_id());
CREATE POLICY "Users can create tiktok folders" ON public.tiktok_folders FOR INSERT WITH CHECK (user_id = get_session_user_id());
CREATE POLICY "Users can update their own tiktok folders" ON public.tiktok_folders FOR UPDATE USING (user_id = get_session_user_id());
CREATE POLICY "Users can delete their own tiktok folders" ON public.tiktok_folders FOR DELETE USING (user_id = get_session_user_id());

-- SECURITY_LOGS table - use get_session_user_id() instead of true
DROP POLICY IF EXISTS "Users can view their own security logs" ON public.security_logs;
DROP POLICY IF EXISTS "Users can insert their own security logs" ON public.security_logs;

CREATE POLICY "Users can view their own security logs" ON public.security_logs FOR SELECT USING (user_id = get_session_user_id());
CREATE POLICY "Users can insert their own security logs" ON public.security_logs FOR INSERT WITH CHECK (user_id = get_session_user_id());

-- FILE_ALBUMS - fix to use get_session_user_id() instead of auth.uid()
DROP POLICY IF EXISTS "Users can view their own file albums" ON public.file_albums;
DROP POLICY IF EXISTS "Users can create file albums" ON public.file_albums;
DROP POLICY IF EXISTS "Users can update their own file albums" ON public.file_albums;
DROP POLICY IF EXISTS "Users can delete their own file albums" ON public.file_albums;

CREATE POLICY "Users can view their own file albums" ON public.file_albums FOR SELECT USING (user_id = get_session_user_id());
CREATE POLICY "Users can create file albums" ON public.file_albums FOR INSERT WITH CHECK (user_id = get_session_user_id());
CREATE POLICY "Users can update their own file albums" ON public.file_albums FOR UPDATE USING (user_id = get_session_user_id());
CREATE POLICY "Users can delete their own file albums" ON public.file_albums FOR DELETE USING (user_id = get_session_user_id());