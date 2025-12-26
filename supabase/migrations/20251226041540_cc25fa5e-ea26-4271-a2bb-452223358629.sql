-- Create table for TikTok videos
CREATE TABLE public.tiktok_videos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  url text NOT NULL,
  video_id text,
  title text DEFAULT '',
  thumbnail_url text,
  author_name text,
  is_favorite boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.tiktok_videos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own tiktok videos" 
ON public.tiktok_videos FOR SELECT USING (true);

CREATE POLICY "Users can create tiktok videos" 
ON public.tiktok_videos FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own tiktok videos" 
ON public.tiktok_videos FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own tiktok videos" 
ON public.tiktok_videos FOR DELETE USING (true);