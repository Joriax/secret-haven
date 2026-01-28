-- Create table for temporary share links
CREATE TABLE public.temp_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('photo', 'file', 'album', 'note', 'link')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  password_hash TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  max_clicks INTEGER,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.temp_shares ENABLE ROW LEVEL SECURITY;

-- Users can create their own share links
CREATE POLICY "Users can create share links"
ON public.temp_shares
FOR INSERT
WITH CHECK (user_id = get_session_user_id());

-- Users can view their own share links
CREATE POLICY "Users can view their own share links"
ON public.temp_shares
FOR SELECT
USING (user_id = get_session_user_id());

-- Users can update their own share links (for click count)
CREATE POLICY "Users can update their own share links"
ON public.temp_shares
FOR UPDATE
USING (user_id = get_session_user_id());

-- Users can delete their own share links
CREATE POLICY "Users can delete their own share links"
ON public.temp_shares
FOR DELETE
USING (user_id = get_session_user_id());

-- Create index for fast token lookup
CREATE INDEX idx_temp_shares_token ON public.temp_shares(token);

-- Create index for cleanup of expired shares
CREATE INDEX idx_temp_shares_expires_at ON public.temp_shares(expires_at);