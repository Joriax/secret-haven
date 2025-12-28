-- Add color and icon columns to albums table for photo albums
ALTER TABLE public.albums ADD COLUMN IF NOT EXISTS color text DEFAULT '#6366f1';
ALTER TABLE public.albums ADD COLUMN IF NOT EXISTS icon text DEFAULT 'folder';