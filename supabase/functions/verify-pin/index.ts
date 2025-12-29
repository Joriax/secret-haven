import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple hash function using Web Crypto API (compatible with Edge Functions)
async function hashPin(pin: string, salt?: string): Promise<string> {
  const actualSalt = salt || crypto.randomUUID();
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + actualSalt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${actualSalt}:${hashHex}`;
}

async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const [salt] = storedHash.split(':');
  const newHash = await hashPin(pin, salt);
  return newHash === storedHash;
}

function normalizeRecoveryKey(key: string): string {
  return key.trim().toUpperCase().replace(/\s+/g, '');
}

function normalizeRecoveryKeyComparable(key: string): string {
  return normalizeRecoveryKey(key).replace(/-/g, '');
}

// Generate a secure random session token
function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validate session token and return user info
async function validateSession(supabase: any, sessionToken: string): Promise<{ userId: string; isDecoy: boolean } | null> {
  if (!sessionToken) return null;
  
  const { data, error } = await supabase
    .from('vault_sessions')
    .select('user_id, is_decoy, expires_at')
    .eq('session_token', sessionToken)
    .single();
  
  if (error || !data) {
    console.log('Session validation failed:', error?.message);
    return null;
  }
  
  if (new Date(data.expires_at) < new Date()) {
    console.log('Session expired');
    return null;
  }
  
  // Update last activity
  await supabase
    .from('vault_sessions')
    .update({ last_activity: new Date().toISOString() })
    .eq('session_token', sessionToken);
  
  return { userId: data.user_id, isDecoy: data.is_decoy };
}

// Create a new session for user
async function createSession(supabase: any, userId: string, isDecoy: boolean): Promise<string> {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session
  
  // Cleanup old sessions for this user
  await supabase
    .from('vault_sessions')
    .delete()
    .eq('user_id', userId);
  
  const { error } = await supabase
    .from('vault_sessions')
    .insert({
      user_id: userId,
      session_token: sessionToken,
      is_decoy: isDecoy,
      expires_at: expiresAt.toISOString()
    });
  
  if (error) {
    console.error('Error creating session:', error);
    throw error;
  }
  
  return sessionToken;
}

// Check if user has admin role
async function isUserAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .single();
  
  return !!data;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, pin, newPin, recoveryKey, targetUserId, sessionToken } = body;
    console.log(`PIN action requested: ${action}`);

    // For actions that require authentication, validate the session token
    let authenticatedUser: { userId: string; isDecoy: boolean } | null = null;
    if (sessionToken) {
      authenticatedUser = await validateSession(supabase, sessionToken);
    }

    if (action === 'verify') {
      // Verify PIN
      if (!pin || pin.length !== 6) {
        console.log('Invalid PIN format');
        return new Response(
          JSON.stringify({ success: false, error: 'PIN muss 6 Ziffern haben' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Get users from database
      const { data: users, error: fetchError } = await supabase
        .from('vault_users')
        .select('id, pin_hash, decoy_pin_hash');

      if (fetchError) {
        console.error('Database error:', fetchError);
        throw fetchError;
      }

      // If no user exists, create default user with PIN 123456
      if (!users || users.length === 0) {
        console.log('No user found, creating default user with PIN 123456');
        const defaultHash = await hashPin('123456');

        const { data: newUser, error: createError } = await supabase
          .from('vault_users')
          .insert({ pin_hash: defaultHash })
          .select()
          .single();

        if (createError) {
          console.error('Error creating default user:', createError);
          throw createError;
        }

        if (pin === '123456') {
          console.log('Login successful with default PIN');
          const token = await createSession(supabase, newUser.id, false);
          return new Response(
            JSON.stringify({ success: true, userId: newUser.id, isDecoy: false, sessionToken: token }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Wrong PIN for default user');
        return new Response(
          JSON.stringify({ success: false, error: 'Falscher PIN' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find matching user (decoy PIN has priority)
      for (const user of users) {
        if (user.decoy_pin_hash) {
          const isDecoy = await verifyPin(pin, user.decoy_pin_hash);
          if (isDecoy) {
            console.log('Decoy PIN verification successful');
            const token = await createSession(supabase, user.id, true);
            return new Response(
              JSON.stringify({ success: true, userId: user.id, isDecoy: true, sessionToken: token }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        const isMain = await verifyPin(pin, user.pin_hash);
        if (isMain) {
          console.log('PIN verification successful');
          const token = await createSession(supabase, user.id, false);
          return new Response(
            JSON.stringify({ success: true, userId: user.id, isDecoy: false, sessionToken: token }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      console.log('PIN verification failed');
      return new Response(
        JSON.stringify({ success: false, error: 'Falscher PIN' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    else if (action === 'verify-recovery') {
      // Verify with recovery key
      const normalized = normalizeRecoveryKeyComparable(recoveryKey || '');
      if (!normalized || normalized.length < 10) {
        return new Response(
          JSON.stringify({ success: false, error: 'Ungültiger Recovery-Key' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Compare normalized keys (avoid .single() and case/format issues)
      const { data: candidates, error: fetchError } = await supabase
        .from('vault_users')
        .select('id, recovery_key')
        .not('recovery_key', 'is', null);

      if (fetchError) {
        console.error('Database error:', fetchError);
        throw fetchError;
      }

      const matched = (candidates || []).find((u: any) => {
        const stored = u.recovery_key as string | null;
        return stored ? normalizeRecoveryKeyComparable(stored) === normalized : false;
      });

      if (!matched) {
        console.log('Recovery key not found');
        return new Response(
          JSON.stringify({ success: false, error: 'Recovery-Key nicht gefunden' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Recovery key verification successful');
      const token = await createSession(supabase, matched.id, false);
      return new Response(
        JSON.stringify({ success: true, userId: matched.id, isDecoy: false, sessionToken: token }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    else if (action === 'validate-session') {
      // Validate an existing session token
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ success: false, error: 'Kein Session-Token' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      if (authenticatedUser) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            userId: authenticatedUser.userId, 
            isDecoy: authenticatedUser.isDecoy 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Ungültige Session' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    else if (action === 'logout') {
      // Invalidate session
      if (sessionToken) {
        await supabase
          .from('vault_sessions')
          .delete()
          .eq('session_token', sessionToken);
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    else if (action === 'change') {
      // Change PIN - REQUIRES valid session
      if (!authenticatedUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nicht autorisiert' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      if (!pin || pin.length !== 6 || !newPin || newPin.length !== 6) {
        return new Response(
          JSON.stringify({ success: false, error: 'PINs müssen 6 Ziffern haben' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Verify current PIN first
      const { data: user, error: fetchError } = await supabase
        .from('vault_users')
        .select('id, pin_hash')
        .eq('id', authenticatedUser.userId)
        .single();

      if (fetchError || !user) {
        console.error('User not found:', fetchError);
        return new Response(
          JSON.stringify({ success: false, error: 'Benutzer nicht gefunden' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      const isValid = await verifyPin(pin, user.pin_hash);
      if (!isValid) {
        console.log('Current PIN verification failed');
        return new Response(
          JSON.stringify({ success: false, error: 'Aktueller PIN ist falsch' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      // Hash new PIN and update
      const newHash = await hashPin(newPin);
      const { error: updateError } = await supabase
        .from('vault_users')
        .update({ pin_hash: newHash, updated_at: new Date().toISOString() })
        .eq('id', authenticatedUser.userId);

      if (updateError) {
        console.error('Error updating PIN:', updateError);
        throw updateError;
      }

      console.log('PIN changed successfully');
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    else if (action === 'set-decoy') {
      // Set decoy PIN - REQUIRES valid session
      if (!authenticatedUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nicht autorisiert' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      if (!pin || pin.length !== 6 || !newPin || newPin.length !== 6) {
        return new Response(
          JSON.stringify({ success: false, error: 'PINs müssen 6 Ziffern haben' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Verify current main PIN first
      const { data: user, error: fetchError } = await supabase
        .from('vault_users')
        .select('id, pin_hash')
        .eq('id', authenticatedUser.userId)
        .single();

      if (fetchError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Benutzer nicht gefunden' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      const isValid = await verifyPin(pin, user.pin_hash);
      if (!isValid) {
        return new Response(
          JSON.stringify({ success: false, error: 'Aktueller PIN ist falsch' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      // Hash decoy PIN and update
      const decoyHash = await hashPin(newPin);
      const { error: updateError } = await supabase
        .from('vault_users')
        .update({ decoy_pin_hash: decoyHash, updated_at: new Date().toISOString() })
        .eq('id', authenticatedUser.userId);

      if (updateError) {
        console.error('Error setting decoy PIN:', updateError);
        throw updateError;
      }

      console.log('Decoy PIN set successfully');
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    else if (action === 'create-user') {
      // Create new user (admin function) - REQUIRES valid session with admin role
      if (!authenticatedUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nicht autorisiert' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      const isAdmin = await isUserAdmin(supabase, authenticatedUser.userId);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      if (!pin || pin.length !== 6) {
        return new Response(
          JSON.stringify({ success: false, error: 'PIN muss 6 Ziffern haben' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Check if PIN is already in use by any user (main PIN or decoy PIN)
      const { data: existingUsers } = await supabase
        .from('vault_users')
        .select('id, pin_hash, decoy_pin_hash');

      if (existingUsers) {
        for (const user of existingUsers) {
          // Check main PIN
          const isMainPin = await verifyPin(pin, user.pin_hash);
          if (isMainPin) {
            return new Response(
              JSON.stringify({ success: false, error: 'Dieser PIN wird bereits verwendet' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }
          // Check decoy PIN
          if (user.decoy_pin_hash) {
            const isDecoyPin = await verifyPin(pin, user.decoy_pin_hash);
            if (isDecoyPin) {
              return new Response(
                JSON.stringify({ success: false, error: 'Dieser PIN wird bereits als Fake-Vault PIN verwendet' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
              );
            }
          }
        }
      }

      // Generate recovery key
      const generatedRecoveryKey = `${crypto.randomUUID().slice(0, 4)}-${crypto.randomUUID().slice(0, 4)}-${crypto.randomUUID().slice(0, 4)}-${crypto.randomUUID().slice(0, 4)}`.toUpperCase();
      
      // Hash the PIN
      const pinHash = await hashPin(pin);
      
      const { data: newUser, error: createError } = await supabase
        .from('vault_users')
        .insert({ 
          pin_hash: pinHash,
          recovery_key: generatedRecoveryKey
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        throw createError;
      }

      console.log('New user created:', newUser.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          userId: newUser.id,
          recoveryKey: generatedRecoveryKey
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    else if (action === 'admin-reset-pin') {
      // Admin resets user PIN - REQUIRES valid session with admin role
      if (!authenticatedUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nicht autorisiert' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      const isAdmin = await isUserAdmin(supabase, authenticatedUser.userId);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      if (!targetUserId || !newPin || newPin.length !== 6) {
        return new Response(
          JSON.stringify({ success: false, error: 'Ungültige Parameter' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Check if new PIN is already in use
      const { data: existingUsers } = await supabase
        .from('vault_users')
        .select('id, pin_hash, decoy_pin_hash')
        .neq('id', targetUserId);

      if (existingUsers) {
        for (const user of existingUsers) {
          const isMainPin = await verifyPin(newPin, user.pin_hash);
          if (isMainPin) {
            return new Response(
              JSON.stringify({ success: false, error: 'Dieser PIN wird bereits verwendet' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }
          if (user.decoy_pin_hash) {
            const isDecoyPin = await verifyPin(newPin, user.decoy_pin_hash);
            if (isDecoyPin) {
              return new Response(
                JSON.stringify({ success: false, error: 'Dieser PIN wird bereits als Fake-Vault PIN verwendet' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
              );
            }
          }
        }
      }

      // Hash new PIN and update
      const newHash = await hashPin(newPin);
      const { error: updateError } = await supabase
        .from('vault_users')
        .update({ pin_hash: newHash, updated_at: new Date().toISOString() })
        .eq('id', targetUserId);

      if (updateError) {
        console.error('Error resetting PIN:', updateError);
        throw updateError;
      }

      console.log(`Admin ${authenticatedUser.userId} reset PIN for user ${targetUserId}`);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    else if (action === 'admin-delete-user') {
      // Admin deletes user and all associated data - REQUIRES valid session with admin role
      if (!authenticatedUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nicht autorisiert' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      const isAdmin = await isUserAdmin(supabase, authenticatedUser.userId);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      if (!targetUserId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Ungültige Parameter' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Prevent self-deletion
      if (targetUserId === authenticatedUser.userId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Du kannst dich nicht selbst löschen' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      console.log(`Admin ${authenticatedUser.userId} deleting user ${targetUserId}`);

      // Delete all user data in order (respecting foreign keys)
      const deletionOrder = [
        // First delete items with foreign keys to other tables
        'note_attachments',
        'note_versions',
        'view_history',
        'security_logs',
        'vault_sessions',
        // Then delete main data tables
        'notes',
        'photos',
        'files',
        'links',
        'tiktok_videos',
        'secret_texts',
        // Delete shared album related data
        'shared_album_items',
        'shared_album_access',
        'shared_albums',
        // Delete folders/albums
        'note_folders',
        'link_folders',
        'tiktok_folders',
        'albums',
        'file_albums',
        // Delete tags
        'tags',
        // Delete user roles
        'user_roles',
        // Finally delete the user
        'vault_users'
      ];

      for (const table of deletionOrder) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq(table === 'vault_users' ? 'id' : (table === 'shared_albums' ? 'owner_id' : 'user_id'), targetUserId);
        
        if (error) {
          console.error(`Error deleting from ${table}:`, error);
          // Continue with other tables even if one fails
        } else {
          console.log(`Deleted data from ${table}`);
        }
      }

      // Also delete storage files
      try {
        // Delete photos from storage
        const { data: photosList } = await supabase.storage
          .from('photos')
          .list(targetUserId);
        if (photosList && photosList.length > 0) {
          const photoPaths = photosList.map((f: any) => `${targetUserId}/${f.name}`);
          await supabase.storage.from('photos').remove(photoPaths);
          console.log('Deleted photos from storage');
        }

        // Delete files from storage
        const { data: filesList } = await supabase.storage
          .from('files')
          .list(targetUserId);
        if (filesList && filesList.length > 0) {
          const filePaths = filesList.map((f: any) => `${targetUserId}/${f.name}`);
          await supabase.storage.from('files').remove(filePaths);
          console.log('Deleted files from storage');
        }

        // Delete note attachments from storage
        const { data: attachmentsList } = await supabase.storage
          .from('note-attachments')
          .list(targetUserId);
        if (attachmentsList && attachmentsList.length > 0) {
          const attachmentPaths = attachmentsList.map((f: any) => `${targetUserId}/${f.name}`);
          await supabase.storage.from('note-attachments').remove(attachmentPaths);
          console.log('Deleted note attachments from storage');
        }
      } catch (storageError) {
        console.error('Error deleting storage files:', storageError);
        // Continue even if storage deletion fails
      }

      console.log(`User ${targetUserId} deleted successfully`);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    else if (action === 'admin-assign-role') {
      // Admin assigns role to user - REQUIRES valid session with admin role
      const { role } = body;
      
      if (!authenticatedUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nicht autorisiert' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      const isAdmin = await isUserAdmin(supabase, authenticatedUser.userId);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      if (!targetUserId || !role) {
        return new Response(
          JSON.stringify({ success: false, error: 'Ungültige Parameter' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Check if role already exists
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('role', role)
        .single();

      if (existingRole) {
        return new Response(
          JSON.stringify({ success: true, message: 'Rolle bereits zugewiesen' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert new role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: targetUserId, role });

      if (insertError) {
        console.error('Error assigning role:', insertError);
        return new Response(
          JSON.stringify({ success: false, error: 'Fehler beim Zuweisen der Rolle' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log(`Admin ${authenticatedUser.userId} assigned role ${role} to user ${targetUserId}`);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    else if (action === 'admin-remove-role') {
      // Admin removes role from user - REQUIRES valid session with admin role
      const { role } = body;
      
      if (!authenticatedUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nicht autorisiert' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      const isAdmin = await isUserAdmin(supabase, authenticatedUser.userId);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      if (!targetUserId || !role) {
        return new Response(
          JSON.stringify({ success: false, error: 'Ungültige Parameter' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Prevent removing own admin role
      if (targetUserId === authenticatedUser.userId && role === 'admin') {
        return new Response(
          JSON.stringify({ success: false, error: 'Du kannst dir nicht selbst die Admin-Rolle entziehen' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Delete role
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', targetUserId)
        .eq('role', role);

      if (deleteError) {
        console.error('Error removing role:', deleteError);
        return new Response(
          JSON.stringify({ success: false, error: 'Fehler beim Entfernen der Rolle' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log(`Admin ${authenticatedUser.userId} removed role ${role} from user ${targetUserId}`);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    else if (action === 'get-user-roles') {
      // Get roles for authenticated user - REQUIRES valid session
      if (!authenticatedUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nicht autorisiert' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', authenticatedUser.userId);

      if (error) {
        console.error('Error fetching roles:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Fehler beim Laden der Rollen' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, roles: roles || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    else if (action === 'admin-get-all-roles') {
      // Get all roles (admin only) - REQUIRES valid session with admin role
      if (!authenticatedUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nicht autorisiert' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      const isAdmin = await isUserAdmin(supabase, authenticatedUser.userId);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching roles:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Fehler beim Laden der Rollen' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, roles: roles || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ungültige Aktion' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Serverfehler' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
