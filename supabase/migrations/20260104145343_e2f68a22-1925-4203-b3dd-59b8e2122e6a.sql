-- Fix vault_users RLS: Remove public access to sensitive PIN data
-- The verify-pin edge function uses SERVICE_ROLE_KEY which bypasses RLS

-- Drop the dangerous public SELECT policy
DROP POLICY IF EXISTS "Anyone can read vault_users for login" ON vault_users;

-- Create a restrictive policy that only allows users to view their own data
CREATE POLICY "Users can view own vault_user" ON vault_users FOR SELECT
USING (id = public.get_session_user_id());

-- Keep existing INSERT/UPDATE/DELETE policies as they don't have USING(true)
-- The verify-pin edge function uses service role key which bypasses RLS