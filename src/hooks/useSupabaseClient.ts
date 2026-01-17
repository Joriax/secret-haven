import { useMemo } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/config';

/**
 * Creates a Supabase client with the session token injected in headers.
 * This is required for RLS policies that use get_session_user_id() function.
 */
export function createAuthenticatedClient(sessionToken: string | null): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: sessionToken ? { 'x-session-token': sessionToken } : {}
    },
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

/**
 * Hook that returns a Supabase client with the current session token.
 * Use this instead of importing supabase directly when you need RLS to work.
 */
export function useSupabaseClient(): SupabaseClient<Database> {
  const { sessionToken } = useAuth();
  
  const client = useMemo(() => {
    return createAuthenticatedClient(sessionToken);
  }, [sessionToken]);
  
  return client;
}
