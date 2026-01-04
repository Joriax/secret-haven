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

    // ========== LINK CRUD ==========
    if (action === 'create-link') {
      const { url, title, folder_id, favicon_url, description, image_url } = requestData || {};
      
      const { data, error } = await supabase
        .from('links')
        .insert({
          user_id: userId,
          url,
          title: title || url,
          folder_id,
          favicon_url,
          description,
          image_url
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-link') {
      const { id, updates } = requestData || {};
      
      const { data, error } = await supabase
        .from('links')
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

    if (action === 'delete-link') {
      const { id, permanent } = requestData || {};
      
      if (permanent) {
        const { error } = await supabase.from('links').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('links').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId);
        if (error) throw error;
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== TIKTOK CRUD ==========
    if (action === 'create-tiktok') {
      const { url, video_id, title, author_name, thumbnail_url, folder_id } = requestData || {};
      
      const { data, error } = await supabase
        .from('tiktok_videos')
        .insert({
          user_id: userId,
          url,
          video_id,
          title,
          author_name,
          thumbnail_url,
          folder_id
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-tiktok') {
      const { id, updates } = requestData || {};
      
      const { data, error } = await supabase
        .from('tiktok_videos')
        .update(updates)
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

    if (action === 'delete-tiktok') {
      const { id, permanent } = requestData || {};
      
      if (permanent) {
        const { error } = await supabase.from('tiktok_videos').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tiktok_videos').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId);
        if (error) throw error;
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== NOTE FOLDERS CRUD ==========
    if (action === 'create-note-folder') {
      const { name, color, icon } = requestData || {};
      
      const { data, error } = await supabase
        .from('note_folders')
        .insert({ user_id: userId, name, color, icon })
        .select()
        .single();
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-note-folder') {
      const { id, updates } = requestData || {};
      
      const { data, error } = await supabase
        .from('note_folders')
        .update(updates)
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

    if (action === 'delete-note-folder') {
      const { id } = requestData || {};
      
      // First, remove folder reference from notes
      await supabase.from('notes').update({ folder_id: null }).eq('folder_id', id).eq('user_id', userId);
      
      const { error } = await supabase.from('note_folders').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== LINK FOLDERS CRUD ==========
    if (action === 'get-link-folders') {
      const { data, error } = await supabase
        .from('link_folders')
        .select('*')
        .eq('user_id', userId)
        .order('name');
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create-link-folder') {
      const { name, color, icon } = requestData || {};
      
      const { data, error } = await supabase
        .from('link_folders')
        .insert({ user_id: userId, name, color, icon })
        .select()
        .single();
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-link-folder') {
      const { id, updates } = requestData || {};
      
      const { data, error } = await supabase
        .from('link_folders')
        .update(updates)
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

    if (action === 'delete-link-folder') {
      const { id } = requestData || {};
      
      await supabase.from('links').update({ folder_id: null }).eq('folder_id', id).eq('user_id', userId);
      
      const { error } = await supabase.from('link_folders').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== TIKTOK FOLDERS CRUD ==========
    if (action === 'get-tiktok-folders') {
      const { data, error } = await supabase
        .from('tiktok_folders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at');
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create-tiktok-folder') {
      const { name, icon, color } = requestData || {};
      
      const { data, error } = await supabase
        .from('tiktok_folders')
        .insert({ user_id: userId, name, icon, color })
        .select()
        .single();
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-tiktok-folder') {
      const { id, updates } = requestData || {};
      
      const { data, error } = await supabase
        .from('tiktok_folders')
        .update(updates)
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

    if (action === 'delete-tiktok-folder') {
      const { id } = requestData || {};
      
      await supabase.from('tiktok_videos').update({ folder_id: null }).eq('folder_id', id).eq('user_id', userId);
      
      const { error } = await supabase.from('tiktok_folders').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== FILE ALBUMS CRUD ==========
    if (action === 'create-file-album') {
      const { name, color, icon } = requestData || {};
      
      const { data, error } = await supabase
        .from('file_albums')
        .insert({ user_id: userId, name, color: color || '#6366f1', icon: icon || 'folder' })
        .select()
        .single();
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-file-album') {
      const { id, updates } = requestData || {};
      
      const { data, error } = await supabase
        .from('file_albums')
        .update(updates)
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

    if (action === 'delete-file-album') {
      const { id } = requestData || {};
      
      // First unlink files from this album
      await supabase.from('files').update({ album_id: null }).eq('album_id', id);
      
      const { error } = await supabase.from('file_albums').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'toggle-file-album-pin') {
      const { id, is_pinned } = requestData || {};
      
      const { error } = await supabase
        .from('file_albums')
        .update({ is_pinned })
        .eq('id', id)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== SHARED ALBUMS CRUD ==========
    if (action === 'get-shared-albums') {
      // Fetch albums I own
      const { data: myAlbums, error: myError } = await supabase
        .from('shared_albums')
        .select('*')
        .eq('owner_id', userId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (myError) throw myError;

      // Fetch albums shared with me
      const { data: accessData, error: accessError } = await supabase
        .from('shared_album_access')
        .select('shared_album_id')
        .eq('user_id', userId);

      if (accessError) throw accessError;

      let sharedAlbums: any[] = [];
      if (accessData && accessData.length > 0) {
        const albumIds = accessData.map((a: any) => a.shared_album_id);
        const { data, error } = await supabase
          .from('shared_albums')
          .select('*')
          .in('id', albumIds);

        if (!error && data) {
          sharedAlbums = data;
        }
      }

      return new Response(
        JSON.stringify({ success: true, data: { albums: myAlbums || [], sharedWithMe: sharedAlbums } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create-shared-album') {
      const { name, content_type, color, description } = requestData || {};
      
      const { data, error } = await supabase
        .from('shared_albums')
        .insert({
          owner_id: userId,
          name,
          content_type: content_type || 'mixed',
          color: color || '#6366f1',
          description: description || null,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-shared-album') {
      const { id, updates } = requestData || {};
      
      const { error } = await supabase
        .from('shared_albums')
        .update(updates)
        .eq('id', id)
        .eq('owner_id', userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete-shared-album') {
      const { id } = requestData || {};
      
      const { error } = await supabase
        .from('shared_albums')
        .delete()
        .eq('id', id)
        .eq('owner_id', userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'generate-public-link') {
      const { id } = requestData || {};
      const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

      const { error } = await supabase
        .from('shared_albums')
        .update({ public_link_enabled: true, public_link_token: token })
        .eq('id', id)
        .eq('owner_id', userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: { token } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disable-public-link') {
      const { id } = requestData || {};

      const { error } = await supabase
        .from('shared_albums')
        .update({ public_link_enabled: false, public_link_token: null })
        .eq('id', id)
        .eq('owner_id', userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'share-album-with-user') {
      const { album_id, target_user_id, permission } = requestData || {};

      const { error } = await supabase
        .from('shared_album_access')
        .upsert({
          shared_album_id: album_id,
          user_id: target_user_id,
          permission: permission || 'view',
        });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'remove-album-user-access') {
      const { album_id, target_user_id } = requestData || {};

      const { error } = await supabase
        .from('shared_album_access')
        .delete()
        .eq('shared_album_id', album_id)
        .eq('user_id', target_user_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-album-access') {
      const { album_id } = requestData || {};

      const { data, error } = await supabase
        .from('shared_album_access')
        .select('*')
        .eq('shared_album_id', album_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'add-item-to-shared-album') {
      const { album_id, item_type, item_id } = requestData || {};
      
      const insertData: Record<string, string> = {
        shared_album_id: album_id,
        added_by: userId,
      };
      insertData[`${item_type}_id`] = item_id;

      const { error } = await supabase
        .from('shared_album_items')
        .insert(insertData);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'remove-item-from-shared-album') {
      const { album_id, item_type, item_id } = requestData || {};

      let query = supabase
        .from('shared_album_items')
        .delete()
        .eq('shared_album_id', album_id);

      // Add the specific item_type filter
      query = query.eq(`${item_type}_id`, item_id);

      const { error } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-shared-album-items') {
      const { album_id } = requestData || {};

      const { data, error } = await supabase
        .from('shared_album_items')
        .select('*')
        .eq('shared_album_id', album_id)
        .order('added_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'toggle-shared-album-pin') {
      const { id, is_pinned } = requestData || {};

      const { error } = await supabase
        .from('shared_albums')
        .update({ is_pinned })
        .eq('id', id)
        .eq('owner_id', userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== BREAK TRACKER ==========
    if (action === 'get-break-entries') {
      const { data, error } = await supabase
        .from('break_entries')
        .select('*')
        .eq('user_id', userId)
        .order('break_date', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'add-break-entry') {
      const { break_date, notes } = requestData || {};

      const { data, error } = await supabase
        .from('break_entries')
        .insert({
          user_id: userId,
          break_date,
          notes
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete-break-entry') {
      const { id } = requestData || {};

      const { error } = await supabase
        .from('break_entries')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-break-settings') {
      const { data, error } = await supabase
        .from('break_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // Create default settings if none exist
      if (!data) {
        const { data: newData, error: insertError } = await supabase
          .from('break_settings')
          .insert({
            user_id: userId,
            reminder_enabled: true,
            reminder_time: '12:00:00'
          })
          .select()
          .single();

        if (insertError) throw insertError;

        return new Response(
          JSON.stringify({ success: true, data: newData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-break-settings') {
      const { reminder_enabled, reminder_time } = requestData || {};

      const { data, error } = await supabase
        .from('break_settings')
        .upsert({
          user_id: userId,
          reminder_enabled,
          reminder_time,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== ADMIN OPERATIONS ==========
    // Check if user is admin for admin operations
    const isUserAdmin = async (checkUserId: string): Promise<boolean> => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', checkUserId)
        .eq('role', 'admin')
        .single();
      return !!data;
    };

    if (action === 'get-admin-stats') {
      // Verify admin role
      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      // Fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from('vault_users')
        .select('id, created_at, recovery_key, admin_notes, last_login_at, login_count, last_login_ip')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      // Fetch active sessions
      const { data: sessionsData } = await supabase
        .from('session_history')
        .select('*')
        .order('login_at', { ascending: false })
        .limit(100);

      // Fetch all roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      // Fetch counts
      const [
        { count: notesCount },
        { count: photosCount },
        { count: filesCount },
        { count: linksCount },
        { count: tiktokCount },
        { count: secretCount },
        { count: albumsCount },
        { count: fileAlbumsCount },
        { count: activeSessionsCount },
        { count: securityLogsCount },
      ] = await Promise.all([
        supabase.from('notes').select('*', { count: 'exact', head: true }),
        supabase.from('photos').select('*', { count: 'exact', head: true }),
        supabase.from('files').select('*', { count: 'exact', head: true }),
        supabase.from('links').select('*', { count: 'exact', head: true }),
        supabase.from('tiktok_videos').select('*', { count: 'exact', head: true }),
        supabase.from('secret_texts').select('*', { count: 'exact', head: true }),
        supabase.from('albums').select('*', { count: 'exact', head: true }),
        supabase.from('file_albums').select('*', { count: 'exact', head: true }),
        supabase.from('vault_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('security_logs').select('*', { count: 'exact', head: true }),
      ]);

      // Get today's login stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: todayLoginsCount } = await supabase
        .from('security_logs')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'login_success')
        .gte('created_at', today.toISOString());

      const { count: failedLoginsCount } = await supabase
        .from('security_logs')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'login_failed')
        .gte('created_at', today.toISOString());

      // Fetch per-user stats
      const userStats: Record<string, any> = {};
      if (usersData && usersData.length > 0) {
        for (const user of usersData) {
          const [
            { count: userNotes },
            { count: userPhotos },
            { count: userFiles },
            { count: userLinks },
            { count: userTiktok },
            { count: userSecret },
          ] = await Promise.all([
            supabase.from('notes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('photos').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('files').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('links').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('tiktok_videos').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('secret_texts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          ]);

          userStats[user.id] = {
            notes: userNotes || 0,
            photos: userPhotos || 0,
            files: userFiles || 0,
            links: userLinks || 0,
            tiktokVideos: userTiktok || 0,
            secretTexts: userSecret || 0,
          };
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            users: usersData || [],
            sessions: sessionsData || [],
            roles: rolesData || [],
            userStats,
            dataCounts: {
              users: usersData?.length || 0,
              notes: notesCount || 0,
              photos: photosCount || 0,
              files: filesCount || 0,
              links: linksCount || 0,
              tiktokVideos: tiktokCount || 0,
              secretTexts: secretCount || 0,
              albums: albumsCount || 0,
              fileAlbums: fileAlbumsCount || 0,
              activeSessions: activeSessionsCount || 0,
              securityLogs: securityLogsCount || 0,
            },
            systemStatus: {
              activeUsers: (sessionsData || []).filter((s: any) => s.is_active).length,
              todayLogins: todayLoginsCount || 0,
              failedLogins: failedLoginsCount || 0,
            },
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'admin-export-data') {
      // Verify admin role
      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      // Fetch all data for export
      const [notes, photos, files, links, tiktoks] = await Promise.all([
        supabase.from('notes').select('*'),
        supabase.from('photos').select('*'),
        supabase.from('files').select('*'),
        supabase.from('links').select('*'),
        supabase.from('tiktok_videos').select('*'),
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            exportedAt: new Date().toISOString(),
            notes: notes.data || [],
            photos: photos.data || [],
            files: files.data || [],
            links: links.data || [],
            tiktoks: tiktoks.data || [],
          }
        }),
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
