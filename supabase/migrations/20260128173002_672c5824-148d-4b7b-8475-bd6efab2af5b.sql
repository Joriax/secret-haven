-- Create note_templates table for markdown templates
CREATE TABLE public.note_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  icon TEXT DEFAULT 'FileText',
  is_system BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.note_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for note_templates
CREATE POLICY "Users can view their own templates"
ON public.note_templates FOR SELECT
USING (user_id = get_session_user_id());

CREATE POLICY "Users can create templates"
ON public.note_templates FOR INSERT
WITH CHECK (user_id = get_session_user_id());

CREATE POLICY "Users can update their own templates"
ON public.note_templates FOR UPDATE
USING (user_id = get_session_user_id());

CREATE POLICY "Users can delete their own templates"
ON public.note_templates FOR DELETE
USING (user_id = get_session_user_id());

-- Create voice_notes table
CREATE TABLE public.voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT DEFAULT '',
  filename TEXT NOT NULL,
  duration INTEGER NOT NULL,
  transcript TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  folder_id UUID REFERENCES public.note_folders(id) ON DELETE SET NULL,
  tags UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for voice_notes
CREATE POLICY "Users can view their own voice notes"
ON public.voice_notes FOR SELECT
USING (user_id = get_session_user_id());

CREATE POLICY "Users can create voice notes"
ON public.voice_notes FOR INSERT
WITH CHECK (user_id = get_session_user_id());

CREATE POLICY "Users can update their own voice notes"
ON public.voice_notes FOR UPDATE
USING (user_id = get_session_user_id());

CREATE POLICY "Users can delete their own voice notes"
ON public.voice_notes FOR DELETE
USING (user_id = get_session_user_id());

-- Create voice-notes storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', false);

-- Storage policies for voice-notes bucket
CREATE POLICY "Users can upload voice notes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'voice-notes' AND 
  (storage.foldername(name))[1] = get_session_user_id()::text
);

CREATE POLICY "Users can view their own voice notes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'voice-notes' AND 
  (storage.foldername(name))[1] = get_session_user_id()::text
);

CREATE POLICY "Users can delete their own voice notes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'voice-notes' AND 
  (storage.foldername(name))[1] = get_session_user_id()::text
);

-- Triggers for updated_at
CREATE TRIGGER update_note_templates_updated_at
BEFORE UPDATE ON public.note_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_voice_notes_updated_at
BEFORE UPDATE ON public.voice_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();