-- Add is_hidden column to albums table
ALTER TABLE public.albums ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

-- Create index for faster queries on hidden status
CREATE INDEX IF NOT EXISTS idx_albums_is_hidden ON public.albums(is_hidden) WHERE is_hidden = true;