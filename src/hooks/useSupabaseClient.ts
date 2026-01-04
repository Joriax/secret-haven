import { useMemo } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://zbniouzrkbkyvkpnpwxa.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpibmlvdXpya2JreXZrcG5wd3hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMTcyMzYsImV4cCI6MjA4MTg5MzIzNn0.gTU98s049QxA0ZCco4rJYFJG5B00LaRPJbFY_6j1es8";

/**
 * Creates a Supabase client with the session token injected in headers.
 * This is required for RLS policies that use get_session_user_id() function.
 */
export function createAuthenticatedClient(sessionToken: string | null): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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
