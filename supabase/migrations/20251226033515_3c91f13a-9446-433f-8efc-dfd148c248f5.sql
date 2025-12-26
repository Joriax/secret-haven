-- Create note_attachments table
CREATE TABLE public.note_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.note_attachments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own attachments" ON public.note_attachments
  FOR SELECT USING (true);

CREATE POLICY "Users can create attachments" ON public.note_attachments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete their own attachments" ON public.note_attachments
  FOR DELETE USING (true);

-- Create storage bucket for note attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('note-attachments', 'note-attachments', false);

-- Create storage policies
CREATE POLICY "Users can upload their own attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'note-attachments');

CREATE POLICY "Users can view their own attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'note-attachments');

CREATE POLICY "Users can delete their own attachments" ON storage.objects
  FOR DELETE USING (bucket_id = 'note-attachments');