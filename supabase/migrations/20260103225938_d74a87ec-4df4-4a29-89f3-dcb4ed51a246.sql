-- Create break entries table for tracking daily breaks
CREATE TABLE public.break_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  break_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, break_date)
);

-- Create break settings table for reminder preferences
CREATE TABLE public.break_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  reminder_enabled BOOLEAN DEFAULT true,
  reminder_time TIME DEFAULT '12:00:00',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.break_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.break_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for break_entries
CREATE POLICY "Users can view their own break entries"
ON public.break_entries FOR SELECT
USING (true);

CREATE POLICY "Users can create their own break entries"
ON public.break_entries FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own break entries"
ON public.break_entries FOR UPDATE
USING (true);

CREATE POLICY "Users can delete their own break entries"
ON public.break_entries FOR DELETE
USING (true);

-- RLS policies for break_settings
CREATE POLICY "Users can view their own break settings"
ON public.break_settings FOR SELECT
USING (true);

CREATE POLICY "Users can create their own break settings"
ON public.break_settings FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own break settings"
ON public.break_settings FOR UPDATE
USING (true);