-- Add is_pinned column to shared_albums table
ALTER TABLE public.shared_albums
ADD COLUMN is_pinned boolean DEFAULT false;