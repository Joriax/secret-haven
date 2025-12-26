import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure URL has protocol
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
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
      const urlObj = new URL(formattedUrl);
      image = image.startsWith('/') 
        ? `${urlObj.origin}${image}`
        : `${urlObj.origin}/${image}`;
    }

    // Get favicon
    const urlObj = new URL(formattedUrl);
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;

    const metadata = {
      title: title || urlObj.hostname,
      description: description || null,
      image: image || null,
      favicon: faviconUrl,
      url: formattedUrl,
    };

    console.log('Metadata extracted:', metadata);

    return new Response(
      JSON.stringify(metadata),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching metadata:', error);
    
    // Return basic data on error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
