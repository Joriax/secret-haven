-- Create a view for vault_users that excludes admin_notes for non-admin access
-- This prevents regular users from seeing administrative notes about them

-- First, drop the existing policy that allows users to view their full record
DROP POLICY IF EXISTS "Users can view own vault_user" ON vault_users;

-- Create a new policy that allows users to SELECT but excludes admin_notes via RLS
-- Since column-level RLS is complex, we use a different approach:
-- 1. Allow full access for admins
-- 2. For regular users, we modify the application to not expose admin_notes

-- Create a function to check if user is an admin (using session-based auth)
CREATE OR REPLACE FUNCTION public.is_session_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = public.get_session_user_id()
      AND ur.role = 'admin'
  )
$$;

-- Create policy for regular users (cannot see admin_notes via view approach)
-- Since PostgreSQL doesn't have column-level RLS, we'll need to handle this at the application level
-- But we CAN restrict what admins can see vs users

-- For now, create separate policies for admin and regular users
CREATE POLICY "Admins can view all vault_users" ON vault_users 
FOR SELECT
USING (is_session_admin() = true);

CREATE POLICY "Users can view own vault_user limited" ON vault_users 
FOR SELECT
USING (
  id = get_session_user_id() 
  AND is_session_admin() = false
);

-- Create a secure view that hides admin_notes for non-admins
CREATE OR REPLACE VIEW public.vault_users_safe AS
SELECT 
  id,
  username,
  pin_hash,
  decoy_pin_hash,
  recovery_key,
  login_count,
  last_login_at,
  last_login_ip,
  created_at,
  updated_at,
  CASE 
    WHEN is_session_admin() THEN admin_notes
    ELSE NULL
  END AS admin_notes
FROM vault_users
WHERE id = get_session_user_id() OR is_session_admin();