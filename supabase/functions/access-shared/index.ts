import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
};

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const password = url.searchParams.get('password');
    const action = url.searchParams.get('action') || 'verify'; // verify, access, info

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the share link
    const { data: share, error: shareError } = await supabaseAdmin
      .from('temp_shares')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (shareError) {
      console.error('Error fetching share:', shareError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!share) {
      return new Response(
        JSON.stringify({ error: 'Link nicht gefunden oder abgelaufen', code: 'NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (new Date(share.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Link ist abgelaufen', code: 'EXPIRED' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check click limit
    if (share.max_clicks !== null && share.click_count >= share.max_clicks) {
      return new Response(
        JSON.stringify({ error: 'Maximale Aufrufe erreicht', code: 'LIMIT_REACHED' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For info action, return metadata without incrementing click count
    if (action === 'info') {
      return new Response(
        JSON.stringify({
          requires_password: !!share.password_hash,
          item_type: share.item_type,
          expires_at: share.expires_at,
          clicks_remaining: share.max_clicks ? share.max_clicks - share.click_count : null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check password if required
    if (share.password_hash) {
      if (!password) {
        return new Response(
          JSON.stringify({ error: 'Passwort erforderlich', code: 'PASSWORD_REQUIRED' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const providedHash = await hashPassword(password);
      if (providedHash !== share.password_hash) {
        return new Response(
          JSON.stringify({ error: 'Falsches Passwort', code: 'WRONG_PASSWORD' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Increment click count
    await supabaseAdmin
      .from('temp_shares')
      .update({ click_count: share.click_count + 1 })
      .eq('id', share.id);

    // Fetch the actual item based on type
    let itemData = null;
    let signedUrl = null;

    if (share.item_type === 'photo') {
      const { data: photo } = await supabaseAdmin
        .from('photos')
        .select('id, filename, caption, tags, uploaded_at')
        .eq('id', share.item_id)
        .maybeSingle();

      if (photo) {
        // Generate signed URL for the photo
        const { data: urlData } = await supabaseAdmin.storage
          .from('photos')
          .createSignedUrl(`${share.user_id}/${photo.filename}`, 3600); // 1 hour

        signedUrl = urlData?.signedUrl;
        itemData = { ...photo, url: signedUrl };
      }
    } else if (share.item_type === 'file') {
      const { data: file } = await supabaseAdmin
        .from('files')
        .select('id, filename, mime_type, size, uploaded_at')
        .eq('id', share.item_id)
        .maybeSingle();

      if (file) {
        const { data: urlData } = await supabaseAdmin.storage
          .from('files')
          .createSignedUrl(`${share.user_id}/${file.filename}`, 3600);

        signedUrl = urlData?.signedUrl;
        itemData = { ...file, url: signedUrl };
      }
    } else if (share.item_type === 'note') {
      const { data: note } = await supabaseAdmin
        .from('notes')
        .select('id, title, content, created_at, updated_at')
        .eq('id', share.item_id)
        .eq('is_secure', false) // Never share secure notes
        .maybeSingle();

      itemData = note;
    }

    if (!itemData) {
      return new Response(
        JSON.stringify({ error: 'Element nicht gefunden', code: 'ITEM_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        item_type: share.item_type,
        item: itemData,
        expires_at: share.expires_at,
        clicks_remaining: share.max_clicks ? share.max_clicks - share.click_count - 1 : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in access-shared:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});