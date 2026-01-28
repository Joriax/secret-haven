import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple hash function for shared album passwords (not for high-security data)
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Rate limiting check
async function checkRateLimit(supabase: any, identifier: string, maxAttempts: number = 5, windowMinutes: number = 15): Promise<boolean> {
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);
  
  const { count } = await supabase
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', identifier)
    .eq('success', false)
    .gte('attempted_at', windowStart.toISOString());
  
  return (count || 0) < maxAttempts;
}

// Record attempt
async function recordAttempt(supabase: any, identifier: string, success: boolean): Promise<void> {
  await supabase.from('login_attempts').insert({
    ip_address: identifier,
    success,
  });
}

// Log access to security logs
async function logAccess(supabase: any, albumId: string, success: boolean, ipAddress: string, userAgent: string): Promise<void> {
  // Use a system user ID for anonymous access logging
  const systemUserId = '00000000-0000-0000-0000-000000000000';
  
  try {
    await supabase.from('security_logs').insert({
      user_id: systemUserId,
      event_type: success ? 'shared_album_access_success' : 'shared_album_access_failed',
      details: { album_id: albumId },
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch (e) {
    console.error('Error logging access:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, token, password } = body;

    // Get client info for rate limiting and logging
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    console.log(`Shared album action: ${action}, token: ${token?.substring(0, 8)}...`);

    if (action === 'set-password') {
      // Set/update password for a shared album (requires session token for auth)
      const { sessionToken, albumId, newPassword } = body;
      
      if (!sessionToken || !albumId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required fields' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Validate session
      const { data: session } = await supabase
        .from('vault_sessions')
        .select('user_id, expires_at')
        .eq('session_token', sessionToken)
        .single();

      if (!session || new Date(session.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      // Verify album ownership
      const { data: album } = await supabase
        .from('shared_albums')
        .select('id, owner_id')
        .eq('id', albumId)
        .eq('owner_id', session.user_id)
        .single();

      if (!album) {
        return new Response(
          JSON.stringify({ success: false, error: 'Album not found or not owned' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // Validate password if provided
      if (newPassword) {
        if (newPassword.length < 4) {
          return new Response(
            JSON.stringify({ success: false, error: 'Password must be at least 4 characters' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        if (newPassword.length > 100) {
          return new Response(
            JSON.stringify({ success: false, error: 'Password too long' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
      }

      // Generate salt and hash password, or clear if no password
      let hashedPassword: string | null = null;
      if (newPassword && newPassword.trim()) {
        const salt = crypto.randomUUID();
        const hash = await hashPassword(newPassword.trim(), salt);
        hashedPassword = `${salt}:${hash}`;
      }

      const { error } = await supabase
        .from('shared_albums')
        .update({ public_link_password: hashedPassword })
        .eq('id', albumId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify-password') {
      // Verify password for accessing a shared album
      if (!token) {
        return new Response(
          JSON.stringify({ success: false, error: 'Token required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Rate limiting
      const rateLimitKey = `shared_album:${token}:${ipAddress}`;
      const allowed = await checkRateLimit(supabase, rateLimitKey, 10, 15);
      
      if (!allowed) {
        return new Response(
          JSON.stringify({ success: false, error: 'Too many attempts. Please wait 15 minutes.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        );
      }

      // Get album by token
      const { data: album, error: albumError } = await supabase
        .from('shared_albums')
        .select('id, name, description, color, content_type, owner_id, public_link_enabled, public_link_password')
        .eq('public_link_token', token)
        .eq('public_link_enabled', true)
        .single();

      if (albumError || !album) {
        await recordAttempt(supabase, rateLimitKey, false);
        return new Response(
          JSON.stringify({ success: false, error: 'Album not found or link disabled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // If no password required, grant access
      if (!album.public_link_password) {
        await logAccess(supabase, album.id, true, ipAddress, userAgent);
        return new Response(
          JSON.stringify({ 
            success: true, 
            needsPassword: false,
            album: {
              id: album.id,
              name: album.name,
              description: album.description,
              color: album.color,
              content_type: album.content_type,
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Password required
      if (!password) {
        return new Response(
          JSON.stringify({ success: true, needsPassword: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify password
      const [salt, storedHash] = album.public_link_password.split(':');
      const inputHash = await hashPassword(password, salt);

      if (inputHash !== storedHash) {
        await recordAttempt(supabase, rateLimitKey, false);
        await logAccess(supabase, album.id, false, ipAddress, userAgent);
        return new Response(
          JSON.stringify({ success: false, error: 'Incorrect password' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      // Password correct
      await recordAttempt(supabase, rateLimitKey, true);
      await logAccess(supabase, album.id, true, ipAddress, userAgent);

      return new Response(
        JSON.stringify({ 
          success: true, 
          needsPassword: false,
          album: {
            id: album.id,
            name: album.name,
            description: album.description,
            color: album.color,
            content_type: album.content_type,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-album-content') {
      // Get album content after password verification
      if (!token) {
        return new Response(
          JSON.stringify({ success: false, error: 'Token required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Get album
      const { data: album } = await supabase
        .from('shared_albums')
        .select('id, owner_id, public_link_enabled')
        .eq('public_link_token', token)
        .eq('public_link_enabled', true)
        .single();

      if (!album) {
        return new Response(
          JSON.stringify({ success: false, error: 'Album not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // Get album items
      const { data: items } = await supabase
        .from('shared_album_items')
        .select('*')
        .eq('shared_album_id', album.id);

      if (!items || items.length === 0) {
        return new Response(
          JSON.stringify({ success: true, items: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch actual content for each item type
      const enrichedItems: any[] = [];
      
      for (const item of items) {
        if (item.photo_id) {
          const { data: photo } = await supabase
            .from('photos')
            .select('id, filename, caption, taken_at')
            .eq('id', item.photo_id)
            .single();
          if (photo) {
            // Generate signed URL - shorter TTL (10 min) for public shared content
            const { data: urlData } = await supabase.storage
              .from('photos')
              .createSignedUrl(`${album.owner_id}/${photo.filename}`, 600);
            enrichedItems.push({
              id: item.id,
              type: 'photo',
              data: { ...photo, url: urlData?.signedUrl },
              added_at: item.added_at,
            });
          }
        } else if (item.note_id) {
          const { data: note } = await supabase
            .from('notes')
            .select('id, title, content')
            .eq('id', item.note_id)
            .single();
          if (note) {
            enrichedItems.push({
              id: item.id,
              type: 'note',
              data: note,
              added_at: item.added_at,
            });
          }
        } else if (item.file_id) {
          const { data: file } = await supabase
            .from('files')
            .select('id, filename, mime_type, size')
            .eq('id', item.file_id)
            .single();
          if (file) {
            // Shorter TTL (10 min) for public shared content
            const { data: urlData } = await supabase.storage
              .from('files')
              .createSignedUrl(`${album.owner_id}/${file.filename}`, 600);
            enrichedItems.push({
              id: item.id,
              type: 'file',
              data: { ...file, url: urlData?.signedUrl },
              added_at: item.added_at,
            });
          }
        } else if (item.link_id) {
          const { data: link } = await supabase
            .from('links')
            .select('id, url, title, description, favicon_url, image_url')
            .eq('id', item.link_id)
            .single();
          if (link) {
            enrichedItems.push({
              id: item.id,
              type: 'link',
              data: link,
              added_at: item.added_at,
            });
          }
        } else if (item.tiktok_id) {
          const { data: tiktok } = await supabase
            .from('tiktok_videos')
            .select('id, url, title, thumbnail_url, author_name')
            .eq('id', item.tiktok_id)
            .single();
          if (tiktok) {
            enrichedItems.push({
              id: item.id,
              type: 'tiktok',
              data: tiktok,
              added_at: item.added_at,
            });
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, items: enrichedItems }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Error in verify-shared-album:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
