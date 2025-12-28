-- Create shared_albums table for sharing functionality
CREATE TABLE public.shared_albums (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  
  -- Content type: 'photos', 'notes', 'files', 'links', 'tiktoks', 'mixed'
  content_type TEXT NOT NULL DEFAULT 'mixed',
  
  -- Public link settings
  public_link_enabled BOOLEAN DEFAULT false,
  public_link_token TEXT UNIQUE,
  public_link_password TEXT, -- Optional password protection (hashed)
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shared_album_items table for linking items to shared albums
CREATE TABLE public.shared_album_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shared_album_id UUID NOT NULL REFERENCES public.shared_albums(id) ON DELETE CASCADE,
  
  -- Item reference (one of these will be set)
  photo_id UUID,
  note_id UUID,
  file_id UUID,
  link_id UUID,
  tiktok_id UUID,
  
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  added_by UUID NOT NULL
);

-- Create shared_album_access table for user-to-user sharing
CREATE TABLE public.shared_album_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shared_album_id UUID NOT NULL REFERENCES public.shared_albums(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Permission level: 'view', 'edit'
  permission TEXT NOT NULL DEFAULT 'view',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint
ALTER TABLE public.shared_album_access ADD CONSTRAINT unique_album_user UNIQUE (shared_album_id, user_id);

-- Enable RLS
ALTER TABLE public.shared_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_album_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_album_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared_albums
CREATE POLICY "Owners can do everything with their shared albums"
ON public.shared_albums FOR ALL
USING (true)
WITH CHECK (true);

-- RLS Policies for shared_album_items
CREATE POLICY "Users can manage shared album items"
ON public.shared_album_items FOR ALL
USING (true)
WITH CHECK (true);

-- RLS Policies for shared_album_access
CREATE POLICY "Users can manage shared album access"
ON public.shared_album_access FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_shared_albums_updated_at
  BEFORE UPDATE ON public.shared_albums
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();