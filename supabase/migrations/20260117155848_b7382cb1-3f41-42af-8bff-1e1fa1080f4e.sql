-- Fix the security definer view issue by replacing with SECURITY INVOKER view
-- and proper application-level filtering

-- Drop the security definer view
DROP VIEW IF EXISTS public.vault_users_safe;

-- Create a SECURITY INVOKER view (default behavior) that uses the is_session_admin function
-- The function itself can be SECURITY DEFINER but the view should be INVOKER
CREATE VIEW public.vault_users_safe 
WITH (security_invoker = true) AS
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
FROM vault_users;

-- Grant access to the view
GRANT SELECT ON public.vault_users_safe TO anon, authenticated;