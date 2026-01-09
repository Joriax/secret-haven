-- Fix overly permissive security_logs INSERT policy
-- The current policy "Anyone can insert security logs" allows any client to insert logs for any user_id
-- This is a security risk as it could be used to pollute logs or impersonate users

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can insert security logs" ON public.security_logs;

-- Keep the properly scoped policy that already exists
-- "Users can insert their own security logs" WITH CHECK (user_id = get_session_user_id())
-- This ensures users can only create logs for their own user_id

-- Add UPDATE denial policy on vault_users to prevent client-side updates (recovery key fix)
-- Currently there's only a SELECT policy, but we need to explicitly deny UPDATE
CREATE POLICY "Deny direct vault_users updates" 
ON public.vault_users 
FOR UPDATE 
USING (false);