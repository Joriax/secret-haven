-- Fix: vault_users table exposes password hashes
-- Strategy: 
-- 1. Drop the existing SELECT policies on vault_users
-- 2. Create a policy that denies all SELECT access to vault_users base table
-- 3. Drop and recreate vault_users_safe view WITHOUT sensitive fields
-- 4. Update RLS so users/admins can only query the safe view

-- Step 1: Drop existing SELECT policies on vault_users
DROP POLICY IF EXISTS "Users can view own vault_user limited" ON public.vault_users;
DROP POLICY IF EXISTS "Admins can view all vault_users" ON public.vault_users;

-- Step 2: Create a policy that denies all SELECT on the base table
-- All access should go through edge functions with service role
CREATE POLICY "Deny all vault_users SELECT"
ON public.vault_users
FOR SELECT
USING (false);

-- Step 3: Drop the existing view and recreate WITHOUT sensitive fields
DROP VIEW IF EXISTS public.vault_users_safe;

CREATE VIEW public.vault_users_safe
WITH (security_invoker=on) AS
SELECT 
  id,
  username,
  login_count,
  last_login_at,
  created_at,
  updated_at
  -- EXCLUDED: pin_hash, decoy_pin_hash, recovery_key, admin_notes, last_login_ip
FROM public.vault_users;

-- Step 4: Grant access to the view for authenticated users
GRANT SELECT ON public.vault_users_safe TO anon;
GRANT SELECT ON public.vault_users_safe TO authenticated;

-- Note: The view uses security_invoker=on which means RLS policies 
-- on the base table will be applied. Since we set SELECT to false,
-- no one can query the view directly either.
-- Edge functions use service_role which bypasses RLS.