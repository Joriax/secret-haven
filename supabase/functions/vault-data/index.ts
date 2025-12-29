import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validate session token
async function validateSession(supabase: any, sessionToken: string): Promise<{ userId: string; isDecoy: boolean } | null> {
  if (!sessionToken) return null;
  
  const { data, error } = await supabase
    .from('vault_sessions')
    .select('user_id, is_decoy, expires_at')
    .eq('session_token', sessionToken)
    .single();
  
  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  
  await supabase
    .from('vault_sessions')
    .update({ last_activity: new Date().toISOString() })
    .eq('session_token', sessionToken);
  
  return { userId: data.user_id, isDecoy: data.is_decoy };
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
    const { action, sessionToken, data: requestData } = body;

    console.log(`Vault data action: ${action}`);

    // Validate session
    const session = await validateSession(supabase, sessionToken);
    if (!session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nicht autorisiert' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // In decoy mode, return empty data
    if (session.isDecoy) {
      return new Response(
        JSON.stringify({ success: true, data: [], count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = session.userId;

    // ========== NOTES ==========
    if (action === 'get-notes') {
      const { folderId, includeDeleted } = requestData || {};
      
      let query = supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId);
      
      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }
      
      if (folderId) {
        query = query.eq('folder_id', folderId);
      }
      
      const { data, error } = await query.order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create-note') {
      const { title, content, folder_id, is_secure, secure_content, tags } = requestData || {};
      
      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: userId,
          title: title || 'Neue Notiz',
          content,
          folder_id,
          is_secure,
          secure_content,
          tags
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-note') {
      const { id, updates } = requestData || {};
      
      const { data, error } = await supabase
        .from('notes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete-note') {
      const { id, permanent } = requestData || {};
      
      if (permanent) {
        const { error } = await supabase
          .from('notes')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notes')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userId);
        
        if (error) throw error;
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== PHOTOS ==========
    if (action === 'get-photos') {
      const { albumId, includeDeleted } = requestData || {};
      
      let query = supabase
        .from('photos')
        .select('*')
        .eq('user_id', userId);
      
      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }
      
      if (albumId) {
        query = query.eq('album_id', albumId);
      }
      
      const { data, error } = await query.order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      
      // Generate signed URLs for photos
      const photosWithUrls = await Promise.all(
        (data || []).map(async (photo: any) => {
          const { data: signedData } = await supabase.storage
            .from('photos')
            .createSignedUrl(`${userId}/${photo.filename}`, 3600);
          return { ...photo, url: signedData?.signedUrl };
        })
      );
      
      return new Response(
        JSON.stringify({ success: true, data: photosWithUrls }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete-photo') {
      const { id, permanent } = requestData || {};
      
      if (permanent) {
        // Get photo to delete file
        const { data: photo } = await supabase
          .from('photos')
          .select('filename')
          .eq('id', id)
          .eq('user_id', userId)
          .single();
        
        if (photo) {
          await supabase.storage.from('photos').remove([`${userId}/${photo.filename}`]);
        }
        
        const { error } = await supabase
          .from('photos')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('photos')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userId);
        
        if (error) throw error;
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== FILES ==========
    if (action === 'get-files') {
      const { albumId, includeDeleted } = requestData || {};
      
      let query = supabase
        .from('files')
        .select('*')
        .eq('user_id', userId);
      
      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }
      
      if (albumId) {
        query = query.eq('album_id', albumId);
      }
      
      const { data, error } = await query.order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete-file') {
      const { id, permanent } = requestData || {};
      
      if (permanent) {
        const { data: file } = await supabase
          .from('files')
          .select('filename')
          .eq('id', id)
          .eq('user_id', userId)
          .single();
        
        if (file) {
          await supabase.storage.from('files').remove([`${userId}/${file.filename}`]);
        }
        
        const { error } = await supabase
          .from('files')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('files')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userId);
        
        if (error) throw error;
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== LINKS ==========
    if (action === 'get-links') {
      const { folderId, includeDeleted } = requestData || {};
      
      let query = supabase
        .from('links')
        .select('*')
        .eq('user_id', userId);
      
      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }
      
      if (folderId) {
        query = query.eq('folder_id', folderId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== TIKTOKS ==========
    if (action === 'get-tiktoks') {
      const { folderId, includeDeleted } = requestData || {};
      
      let query = supabase
        .from('tiktok_videos')
        .select('*')
        .eq('user_id', userId);
      
      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }
      
      if (folderId) {
        query = query.eq('folder_id', folderId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== SECRET TEXTS ==========
    if (action === 'get-secret-texts') {
      const { data, error } = await supabase
        .from('secret_texts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== SECURITY LOGS ==========
    if (action === 'get-security-logs') {
      const { limit: logLimit = 100 } = requestData || {};
      
      const { data, error } = await supabase
        .from('security_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(logLimit);
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== SESSION HISTORY ==========
    if (action === 'get-session-history') {
      const { data, error } = await supabase
        .from('session_history')
        .select('*')
        .eq('user_id', userId)
        .order('login_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== VIEW HISTORY ==========
    if (action === 'get-view-history') {
      const { data, error } = await supabase
        .from('view_history')
        .select('*')
        .eq('user_id', userId)
        .order('viewed_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'record-view') {
      const { itemType, itemId } = requestData || {};
      
      // Remove old entry for same item
      await supabase
        .from('view_history')
        .delete()
        .eq('user_id', userId)
        .eq('item_type', itemType)
        .eq('item_id', itemId);
      
      // Insert new entry
      await supabase.from('view_history').insert({
        user_id: userId,
        item_type: itemType,
        item_id: itemId
      });
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== FOLDERS ==========
    if (action === 'get-note-folders') {
      const { data, error } = await supabase
        .from('note_folders')
        .select('*')
        .eq('user_id', userId)
        .order('name');
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-albums') {
      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .eq('user_id', userId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-file-albums') {
      const { data, error } = await supabase
        .from('file_albums')
        .select('*')
        .eq('user_id', userId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== TRASH ==========
    if (action === 'get-trash') {
      const [notes, photos, files, links, tiktoks] = await Promise.all([
        supabase.from('notes').select('*').eq('user_id', userId).not('deleted_at', 'is', null),
        supabase.from('photos').select('*').eq('user_id', userId).not('deleted_at', 'is', null),
        supabase.from('files').select('*').eq('user_id', userId).not('deleted_at', 'is', null),
        supabase.from('links').select('*').eq('user_id', userId).not('deleted_at', 'is', null),
        supabase.from('tiktok_videos').select('*').eq('user_id', userId).not('deleted_at', 'is', null),
      ]);
      
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            notes: notes.data || [],
            photos: photos.data || [],
            files: files.data || [],
            links: links.data || [],
            tiktoks: tiktoks.data || []
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'restore-item') {
      const { itemType, itemId } = requestData || {};
      
      const tableMap: Record<string, string> = {
        note: 'notes',
        photo: 'photos',
        file: 'files',
        link: 'links',
        tiktok: 'tiktok_videos'
      };
      
      const table = tableMap[itemType];
      if (!table) {
        return new Response(
          JSON.stringify({ success: false, error: 'Ungültiger Typ' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: null })
        .eq('id', itemId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'empty-trash') {
      const tables = ['notes', 'photos', 'files', 'links', 'tiktok_videos'];
      
      for (const table of tables) {
        // For photos and files, delete storage too
        if (table === 'photos' || table === 'files') {
          const { data: items } = await supabase
            .from(table)
            .select('filename')
            .eq('user_id', userId)
            .not('deleted_at', 'is', null);
          
          if (items?.length) {
            const bucket = table === 'photos' ? 'photos' : 'files';
            const paths = items.map((i: any) => `${userId}/${i.filename}`);
            await supabase.storage.from(bucket).remove(paths);
          }
        }
        
        await supabase
          .from(table)
          .delete()
          .eq('user_id', userId)
          .not('deleted_at', 'is', null);
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ungültige Aktion' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Vault data error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Serverfehler' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
