import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Blocked hosts to prevent SSRF attacks
const isBlockedHost = (hostname: string): boolean => {
  const blockedPatterns = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '169.254.169.254', // AWS metadata
    'metadata.google.internal', // GCP metadata
  ];

  // Check exact matches
  if (blockedPatterns.includes(hostname.toLowerCase())) {
    return true;
  }

  // Check private IP ranges
  const privateIpPatterns = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^fc00:/i, // IPv6 private
    /^fe80:/i, // IPv6 link-local
  ];

  return privateIpPatterns.some(pattern => pattern.test(hostname));
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

    // Ensure URL has protocol
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Parse and validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(formattedUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Block internal/private hosts (SSRF protection)
    if (isBlockedHost(parsedUrl.hostname)) {
      console.log('Blocked SSRF attempt to:', parsedUrl.hostname);
      return new Response(
        JSON.stringify({ error: 'Invalid or blocked hostname' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return new Response(
        JSON.stringify({ error: 'Only HTTP/HTTPS protocols allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching metadata for:', formattedUrl);

    // Fetch the page with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(formattedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreview/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de,en;q=0.5',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Parse meta tags
    const getMetaContent = (name: string): string | null => {
      // Try og: tags first
      const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${name}["'][^>]*content=["']([^"']+)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${name}["']`, 'i'));
      if (ogMatch) return ogMatch[1];

      // Try twitter: tags
      const twitterMatch = html.match(new RegExp(`<meta[^>]*name=["']twitter:${name}["'][^>]*content=["']([^"']+)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:${name}["']`, 'i'));
      if (twitterMatch) return twitterMatch[1];

      // Try standard meta tags
      const metaMatch = html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`, 'i'));
      if (metaMatch) return metaMatch[1];

      return null;
    };

    // Get title
    let title = getMetaContent('title');
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = titleMatch ? titleMatch[1].trim() : null;
    }

    // Get description
    const description = getMetaContent('description');

    // Get image
    let image = getMetaContent('image');
    if (image && !image.startsWith('http')) {
      // Make relative URLs absolute
      image = image.startsWith('/') 
        ? `${parsedUrl.origin}${image}`
        : `${parsedUrl.origin}/${image}`;
    }

    // Get favicon
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=64`;

    const metadata = {
      title: title || parsedUrl.hostname,
      description: description || null,
      image: image || null,
      favicon: faviconUrl,
      url: formattedUrl,
    };

    console.log('Metadata extracted successfully');

    return new Response(
      JSON.stringify(metadata),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error fetching metadata:', error);
    
    const isAbortError = error instanceof Error && error.name === 'AbortError';
    const errorMessage = isAbortError ? 'Request timeout' : 'Failed to fetch metadata';
    
    return new Response(
      JSON.stringify({ 
        title: null, 
        description: null, 
        image: null, 
        favicon: null,
        error: errorMessage 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
