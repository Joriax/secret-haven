-- Create storage bucket for backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false);

-- Create RLS policies for backups bucket
CREATE POLICY "Users can view own backups"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'backups' 
  AND (storage.foldername(name))[1] = public.get_session_user_id()::text
);

CREATE POLICY "Users can upload own backups"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'backups' 
  AND (storage.foldername(name))[1] = public.get_session_user_id()::text
);

CREATE POLICY "Users can delete own backups"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'backups' 
  AND (storage.foldername(name))[1] = public.get_session_user_id()::text
);

-- Create table to track backup versions
CREATE TABLE public.backup_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  item_counts JSONB NOT NULL DEFAULT '{}',
  includes_media BOOLEAN NOT NULL DEFAULT false,
  is_auto_backup BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.backup_versions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for backup_versions
CREATE POLICY "Users can view own backup versions"
ON public.backup_versions
FOR SELECT
USING (user_id = public.get_session_user_id());

CREATE POLICY "Users can create own backup versions"
ON public.backup_versions
FOR INSERT
WITH CHECK (user_id = public.get_session_user_id());

CREATE POLICY "Users can delete own backup versions"
ON public.backup_versions
FOR DELETE
USING (user_id = public.get_session_user_id());

-- Create table for auto-backup settings
CREATE TABLE public.backup_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  auto_backup_enabled BOOLEAN NOT NULL DEFAULT false,
  backup_frequency TEXT NOT NULL DEFAULT 'weekly',
  include_media BOOLEAN NOT NULL DEFAULT true,
  max_versions INTEGER NOT NULL DEFAULT 5,
  last_auto_backup TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.backup_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for backup_settings
CREATE POLICY "Users can view own backup settings"
ON public.backup_settings
FOR SELECT
USING (user_id = public.get_session_user_id());

CREATE POLICY "Users can create own backup settings"
ON public.backup_settings
FOR INSERT
WITH CHECK (user_id = public.get_session_user_id());

CREATE POLICY "Users can update own backup settings"
ON public.backup_settings
FOR UPDATE
USING (user_id = public.get_session_user_id());