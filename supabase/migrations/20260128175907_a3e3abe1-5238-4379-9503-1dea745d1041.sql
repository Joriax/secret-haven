-- Create note_reminders table for reminder system
CREATE TABLE IF NOT EXISTS public.note_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  note_id UUID REFERENCES public.notes(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_type TEXT CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.note_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for note_reminders
CREATE POLICY "Users can view their own reminders"
  ON public.note_reminders FOR SELECT
  USING (user_id = get_session_user_id());

CREATE POLICY "Users can create reminders"
  ON public.note_reminders FOR INSERT
  WITH CHECK (user_id = get_session_user_id());

CREATE POLICY "Users can update their own reminders"
  ON public.note_reminders FOR UPDATE
  USING (user_id = get_session_user_id());

CREATE POLICY "Users can delete their own reminders"
  ON public.note_reminders FOR DELETE
  USING (user_id = get_session_user_id());

-- Create notifications table for notification center
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('reminder', 'security', 'system', 'share', 'backup')),
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = get_session_user_id());

CREATE POLICY "Users can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (user_id = get_session_user_id());

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = get_session_user_id());

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = get_session_user_id());

-- Create self_destructing_notes table
CREATE TABLE IF NOT EXISTS public.self_destructing_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT,
  encrypted_content TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT false,
  destruct_at TIMESTAMP WITH TIME ZONE NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  max_views INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.self_destructing_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own self-destructing notes"
  ON public.self_destructing_notes FOR SELECT
  USING (user_id = get_session_user_id());

CREATE POLICY "Users can create self-destructing notes"
  ON public.self_destructing_notes FOR INSERT
  WITH CHECK (user_id = get_session_user_id());

CREATE POLICY "Users can update their own self-destructing notes"
  ON public.self_destructing_notes FOR UPDATE
  USING (user_id = get_session_user_id());

CREATE POLICY "Users can delete their own self-destructing notes"
  ON public.self_destructing_notes FOR DELETE
  USING (user_id = get_session_user_id());

-- Create file_versions table for file versioning
CREATE TABLE IF NOT EXISTS public.file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES public.files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  filename TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own file versions"
  ON public.file_versions FOR SELECT
  USING (user_id = get_session_user_id());

CREATE POLICY "Users can create file versions"
  ON public.file_versions FOR INSERT
  WITH CHECK (user_id = get_session_user_id());

-- Create note_comments table for collaboration
CREATE TABLE IF NOT EXISTS public.note_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.note_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.note_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view comments on their notes"
  ON public.note_comments FOR SELECT
  USING (user_id = get_session_user_id());

CREATE POLICY "Users can create comments"
  ON public.note_comments FOR INSERT
  WITH CHECK (user_id = get_session_user_id());

CREATE POLICY "Users can update their own comments"
  ON public.note_comments FOR UPDATE
  USING (user_id = get_session_user_id());

CREATE POLICY "Users can delete their own comments"
  ON public.note_comments FOR DELETE
  USING (user_id = get_session_user_id());

-- Create user_preferences table for personalization settings
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  font_family TEXT DEFAULT 'system',
  font_size TEXT DEFAULT 'normal',
  density TEXT DEFAULT 'normal' CHECK (density IN ('compact', 'normal', 'comfortable')),
  icon_pack TEXT DEFAULT 'lucide',
  custom_css TEXT,
  dashboard_layout JSONB DEFAULT '{}',
  sync_settings JSONB DEFAULT '{}',
  haptics_enabled BOOLEAN DEFAULT true,
  screenshot_protection BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own preferences"
  ON public.user_preferences FOR SELECT
  USING (user_id = get_session_user_id());

CREATE POLICY "Users can create preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (user_id = get_session_user_id());

CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences FOR UPDATE
  USING (user_id = get_session_user_id());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_note_reminders_user_remind ON public.note_reminders(user_id, remind_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_self_destructing_notes_destruct ON public.self_destructing_notes(destruct_at);
CREATE INDEX IF NOT EXISTS idx_file_versions_file ON public.file_versions(file_id, version_number);
CREATE INDEX IF NOT EXISTS idx_note_comments_note ON public.note_comments(note_id);

-- Trigger for updated_at
CREATE TRIGGER update_note_reminders_updated_at
  BEFORE UPDATE ON public.note_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_note_comments_updated_at
  BEFORE UPDATE ON public.note_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();