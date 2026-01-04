
-- Add RLS policies for login_attempts table
-- This table is managed by edge functions using service role, so we deny all client access
CREATE POLICY "Deny all client access to login_attempts"
ON public.login_attempts
FOR ALL
USING (false)
WITH CHECK (false);

-- Add RLS policies for vault_sessions table  
-- This table is managed by edge functions using service role, so we deny all client access
CREATE POLICY "Deny all client access to vault_sessions"
ON public.vault_sessions
FOR ALL
USING (false)
WITH CHECK (false);
