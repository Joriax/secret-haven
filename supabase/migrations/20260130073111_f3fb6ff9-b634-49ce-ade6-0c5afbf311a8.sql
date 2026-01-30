-- Fix: prevent direct client SELECT access to sensitive security_logs
-- The app already reads logs via the verify-pin backend function, so we can safely deny direct SELECT.

DROP POLICY IF EXISTS "Security logs session access" ON public.security_logs;
DROP POLICY IF EXISTS "Users can view their own security logs" ON public.security_logs;

CREATE POLICY "Deny direct security_logs SELECT"
ON public.security_logs
FOR SELECT
USING (false);