-- Create users table for PIN authentication
CREATE TABLE public.vault_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create notes table
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.vault_users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create albums table
CREATE TABLE public.albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.vault_users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create photos table
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.vault_users(id) ON DELETE CASCADE NOT NULL,
  album_id UUID REFERENCES public.albums(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  caption TEXT DEFAULT '',
  taken_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create files table
CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.vault_users(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.vault_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vault_users (public read for login, no direct insert)
CREATE POLICY "Anyone can read vault_users for login" ON public.vault_users FOR SELECT USING (true);

-- RLS Policies for notes
CREATE POLICY "Users can view their own notes" ON public.notes FOR SELECT USING (true);
CREATE POLICY "Users can create notes" ON public.notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own notes" ON public.notes FOR UPDATE USING (true);
CREATE POLICY "Users can delete their own notes" ON public.notes FOR DELETE USING (true);

-- RLS Policies for albums
CREATE POLICY "Users can view their own albums" ON public.albums FOR SELECT USING (true);
CREATE POLICY "Users can create albums" ON public.albums FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own albums" ON public.albums FOR UPDATE USING (true);
CREATE POLICY "Users can delete their own albums" ON public.albums FOR DELETE USING (true);

-- RLS Policies for photos
CREATE POLICY "Users can view their own photos" ON public.photos FOR SELECT USING (true);
CREATE POLICY "Users can create photos" ON public.photos FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own photos" ON public.photos FOR UPDATE USING (true);
CREATE POLICY "Users can delete their own photos" ON public.photos FOR DELETE USING (true);

-- RLS Policies for files
CREATE POLICY "Users can view their own files" ON public.files FOR SELECT USING (true);
CREATE POLICY "Users can create files" ON public.files FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own files" ON public.files FOR UPDATE USING (true);
CREATE POLICY "Users can delete their own files" ON public.files FOR DELETE USING (true);

-- Create storage buckets for photos and files
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', false);

-- Storage policies for photos bucket
CREATE POLICY "Users can view photos" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "Users can upload photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'photos');
CREATE POLICY "Users can delete photos" ON storage.objects FOR DELETE USING (bucket_id = 'photos');

-- Storage policies for files bucket
CREATE POLICY "Users can view files" ON storage.objects FOR SELECT USING (bucket_id = 'files');
CREATE POLICY "Users can upload files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'files');
CREATE POLICY "Users can delete files" ON storage.objects FOR DELETE USING (bucket_id = 'files');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to notes
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Apply trigger to vault_users
CREATE TRIGGER update_vault_users_updated_at
  BEFORE UPDATE ON public.vault_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();