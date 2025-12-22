-- Erweitere vault_users für Tarnmodus und Recovery
ALTER TABLE public.vault_users 
ADD COLUMN IF NOT EXISTS decoy_pin_hash text,
ADD COLUMN IF NOT EXISTS recovery_key text;

-- Security Logs Tabelle
CREATE TABLE IF NOT EXISTS public.security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  details jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own security logs" ON public.security_logs
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert security logs" ON public.security_logs
  FOR INSERT WITH CHECK (true);

-- Tags Tabelle
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tags" ON public.tags FOR SELECT USING (true);
CREATE POLICY "Users can create tags" ON public.tags FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own tags" ON public.tags FOR UPDATE USING (true);
CREATE POLICY "Users can delete their own tags" ON public.tags FOR DELETE USING (true);

-- Erweitere notes Tabelle
ALTER TABLE public.notes 
ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_secure boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS secure_content text,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS tags uuid[] DEFAULT '{}';

-- Erweitere photos Tabelle
ALTER TABLE public.photos 
ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS tags uuid[] DEFAULT '{}';

-- Erweitere files Tabelle
ALTER TABLE public.files 
ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS tags uuid[] DEFAULT '{}';

-- Note Versions Tabelle für Versionierung
CREATE TABLE IF NOT EXISTS public.note_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  content text,
  version_number integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own note versions" ON public.note_versions FOR SELECT USING (true);
CREATE POLICY "Users can create note versions" ON public.note_versions FOR INSERT WITH CHECK (true);

-- Secret Texts Tabelle (Geheimer Text-Safe)
CREATE TABLE IF NOT EXISTS public.secret_texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  encrypted_content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.secret_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own secret texts" ON public.secret_texts FOR SELECT USING (true);
CREATE POLICY "Users can create secret texts" ON public.secret_texts FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own secret texts" ON public.secret_texts FOR UPDATE USING (true);
CREATE POLICY "Users can delete their own secret texts" ON public.secret_texts FOR DELETE USING (true);

-- View History Tabelle
CREATE TABLE IF NOT EXISTS public.view_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  viewed_at timestamptz DEFAULT now()
);

ALTER TABLE public.view_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own history" ON public.view_history FOR SELECT USING (true);
CREATE POLICY "Users can create history" ON public.view_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete their own history" ON public.view_history FOR DELETE USING (true);

-- Trigger für secret_texts updated_at
CREATE TRIGGER update_secret_texts_updated_at
  BEFORE UPDATE ON public.secret_texts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();