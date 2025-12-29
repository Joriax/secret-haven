-- Create rate limiting table for tracking login attempts
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  attempted_at timestamp with time zone DEFAULT now(),
  success boolean DEFAULT false
);

-- Create index for efficient querying
CREATE INDEX idx_login_attempts_ip_time ON public.login_attempts(ip_address, attempted_at);

-- Add location and device info columns to security_logs
ALTER TABLE public.security_logs 
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS region text,
ADD COLUMN IF NOT EXISTS browser text,
ADD COLUMN IF NOT EXISTS os text,
ADD COLUMN IF NOT EXISTS device_type text;

-- Add last login tracking to vault_users
ALTER TABLE public.vault_users 
ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS login_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login_ip text;

-- Create session history table for detailed login tracking
CREATE TABLE public.session_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.vault_users(id) ON DELETE CASCADE,
  login_at timestamp with time zone DEFAULT now(),
  logout_at timestamp with time zone,
  ip_address text,
  user_agent text,
  country text,
  city text,
  region text,
  browser text,
  os text,
  device_type text,
  is_active boolean DEFAULT true
);

CREATE INDEX idx_session_history_user ON public.session_history(user_id, login_at DESC);

-- Enable RLS on new tables
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for login_attempts (edge function access only via service role)
-- No client policies needed - only service role should access this

-- RLS policies for session_history
CREATE POLICY "Users can view their own session history"
ON public.session_history FOR SELECT
USING (user_id = (SELECT user_id FROM public.vault_sessions WHERE session_token = current_setting('request.headers', true)::json->>'x-session-token' LIMIT 1));

-- Function to cleanup old login attempts (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM login_attempts WHERE attempted_at < now() - interval '1 hour';
$$;