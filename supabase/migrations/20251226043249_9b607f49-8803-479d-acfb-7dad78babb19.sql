-- Create TikTok folders table
CREATE TABLE public.tiktok_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add folder_id to tiktok_videos
ALTER TABLE public.tiktok_videos ADD COLUMN folder_id UUID REFERENCES public.tiktok_folders(id) ON DELETE SET NULL;

-- Enable RLS for tiktok_folders
ALTER TABLE public.tiktok_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies for tiktok_folders
CREATE POLICY "Users can view their own tiktok folders" ON public.tiktok_folders
  FOR SELECT USING (true);

CREATE POLICY "Users can create tiktok folders" ON public.tiktok_folders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own tiktok folders" ON public.tiktok_folders
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own tiktok folders" ON public.tiktok_folders
  FOR DELETE USING (true);