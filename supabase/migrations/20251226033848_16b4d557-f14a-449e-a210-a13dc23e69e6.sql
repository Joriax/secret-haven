-- Create link_folders table
CREATE TABLE public.link_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create links table
CREATE TABLE public.links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  folder_id UUID REFERENCES public.link_folders(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  favicon_url TEXT,
  is_favorite BOOLEAN DEFAULT false,
  tags UUID[] DEFAULT '{}',
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.link_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;

-- RLS policies for link_folders
CREATE POLICY "Users can view their own link folders" ON public.link_folders FOR SELECT USING (true);
CREATE POLICY "Users can create link folders" ON public.link_folders FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own link folders" ON public.link_folders FOR UPDATE USING (true);
CREATE POLICY "Users can delete their own link folders" ON public.link_folders FOR DELETE USING (true);

-- RLS policies for links
CREATE POLICY "Users can view their own links" ON public.links FOR SELECT USING (true);
CREATE POLICY "Users can create links" ON public.links FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own links" ON public.links FOR UPDATE USING (true);
CREATE POLICY "Users can delete their own links" ON public.links FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_links_updated_at
  BEFORE UPDATE ON public.links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();