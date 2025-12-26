-- Add image_url column to links table
ALTER TABLE public.links ADD COLUMN IF NOT EXISTS image_url text;