-- Create file_albums table for file organization
CREATE TABLE public.file_albums (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#6366f1',
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add is_pinned to existing albums table (for photos)
ALTER TABLE public.albums ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- Add album_id to files table
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS album_id UUID REFERENCES public.file_albums(id) ON DELETE SET NULL;

-- Enable RLS for file_albums
ALTER TABLE public.file_albums ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for file_albums
CREATE POLICY "Users can view their own file albums" 
ON public.file_albums 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create file albums" 
ON public.file_albums 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own file albums" 
ON public.file_albums 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own file albums" 
ON public.file_albums 
FOR DELETE 
USING (auth.uid() = user_id);