-- Create note_folders table
CREATE TABLE public.note_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.note_folders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own folders" ON public.note_folders
  FOR SELECT USING (true);

CREATE POLICY "Users can create folders" ON public.note_folders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own folders" ON public.note_folders
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own folders" ON public.note_folders
  FOR DELETE USING (true);

-- Add folder_id to notes table
ALTER TABLE public.notes ADD COLUMN folder_id UUID REFERENCES public.note_folders(id) ON DELETE SET NULL;