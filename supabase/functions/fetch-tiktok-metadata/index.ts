import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validate that URL is actually a TikTok URL
const isValidTikTokUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    return hostname === 'tiktok.com' || 
           hostname === 'www.tiktok.com' || 
           hostname === 'vm.tiktok.com' ||
           hostname.endsWith('.tiktok.com');
  } catch {
    return false;
  }
};

// Validate session token
const validateSession = async (supabaseUrl: string, supabaseServiceKey: string, sessionToken: string): Promise<boolean> => {
  if (!sessionToken) return false;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from('vault_sessions')
    .select('user_id')
    .eq('session_token', sessionToken)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  return !error && data !== null;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, sessionToken } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate session (require authentication)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const isValidSession = await validateSession(supabaseUrl, supabaseServiceKey, sessionToken);
    if (!isValidSession) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - valid session required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that URL is actually a TikTok URL (prevent SSRF)
    if (!isValidTikTokUrl(url)) {
      console.log('Blocked non-TikTok URL:', url);
      return new Response(
        JSON.stringify({ error: 'Only TikTok URLs are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching TikTok metadata for:', url);

    // Try to use TikTok's oEmbed API
    const oEmbedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(oEmbedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log('oEmbed request failed:', response.status);
      return new Response(
        JSON.stringify({ 
          title: null, 
          author_name: null, 
          thumbnail_url: null,
          error: 'Could not fetch metadata' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('TikTok oEmbed response received');

    return new Response(
      JSON.stringify({
        title: data.title || null,
        author_name: data.author_name || null,
        thumbnail_url: data.thumbnail_url || null,
        video_id: data.embed_product_id || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error fetching TikTok metadata:', error);
    
    const isAbortError = error instanceof Error && error.name === 'AbortError';
    
    return new Response(
      JSON.stringify({ 
        title: null, 
        author_name: null, 
        thumbnail_url: null,
        error: isAbortError ? 'Request timeout' : 'Failed to fetch metadata'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
