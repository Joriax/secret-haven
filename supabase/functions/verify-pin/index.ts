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
    const { action, pin, newPin, userId, recoveryKey, targetUserId, adminUserId } = body;
    console.log(`PIN action requested: ${action}`);

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
          return new Response(
            JSON.stringify({ success: true, userId: newUser.id, isDecoy: false }),
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
            return new Response(
              JSON.stringify({ success: true, userId: user.id, isDecoy: true }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        const isMain = await verifyPin(pin, user.pin_hash);
        if (isMain) {
          console.log('PIN verification successful');
          return new Response(
            JSON.stringify({ success: true, userId: user.id, isDecoy: false }),
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

      const matched = (candidates || []).find((u) => {
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
      return new Response(
        JSON.stringify({ success: true, userId: matched.id, isDecoy: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    else if (action === 'change') {
      // Change PIN
      if (!userId) {
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
        .eq('id', userId)
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
        .eq('id', userId);

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
      // Set decoy PIN
      if (!userId) {
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
        .eq('id', userId)
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
        .eq('id', userId);

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
      // Create new user (admin function)
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
      const recoveryKey = `${crypto.randomUUID().slice(0, 4)}-${crypto.randomUUID().slice(0, 4)}-${crypto.randomUUID().slice(0, 4)}-${crypto.randomUUID().slice(0, 4)}`.toUpperCase();
      
      // Hash the PIN
      const pinHash = await hashPin(pin);
      
      const { data: newUser, error: createError } = await supabase
        .from('vault_users')
        .insert({ 
          pin_hash: pinHash,
          recovery_key: recoveryKey
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
          recoveryKey
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    else if (action === 'admin-reset-pin') {
      // Admin resets user PIN - uses targetUserId and adminUserId from initial body parse
      if (!targetUserId || !newPin || newPin.length !== 6) {
        return new Response(
          JSON.stringify({ success: false, error: 'Ungültige Parameter' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Verify admin has admin role
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', adminUserId)
        .eq('role', 'admin')
        .single();

      if (!adminRole) {
        return new Response(
          JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
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

      console.log(`Admin ${adminUserId} reset PIN for user ${targetUserId}`);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    else if (action === 'admin-delete-user') {
      // Admin deletes user and all associated data - uses targetUserId and adminUserId from initial body parse
      if (!targetUserId || !adminUserId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Ungültige Parameter' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Prevent self-deletion
      if (targetUserId === adminUserId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Du kannst dich nicht selbst löschen' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Verify admin has admin role
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', adminUserId)
        .eq('role', 'admin')
        .single();

      if (!adminRole) {
        return new Response(
          JSON.stringify({ success: false, error: 'Keine Admin-Berechtigung' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      console.log(`Admin ${adminUserId} deleting user ${targetUserId}`);

      // Delete all user data in order (respecting foreign keys)
      const deletionOrder = [
        // First delete items with foreign keys to other tables
        'note_attachments',
        'note_versions',
        'view_history',
        'security_logs',
        // Then delete main data tables
        'notes',
        'photos',
        'files',
        'links',
        'tiktok_videos',
        'secret_texts',
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
          .eq(table === 'vault_users' ? 'id' : 'user_id', targetUserId);
        
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
          const photoPaths = photosList.map(f => `${targetUserId}/${f.name}`);
          await supabase.storage.from('photos').remove(photoPaths);
          console.log('Deleted photos from storage');
        }

        // Delete files from storage
        const { data: filesList } = await supabase.storage
          .from('files')
          .list(targetUserId);
        if (filesList && filesList.length > 0) {
          const filePaths = filesList.map(f => `${targetUserId}/${f.name}`);
          await supabase.storage.from('files').remove(filePaths);
          console.log('Deleted files from storage');
        }

        // Delete note attachments from storage
        const { data: attachmentsList } = await supabase.storage
          .from('note-attachments')
          .list(targetUserId);
        if (attachmentsList && attachmentsList.length > 0) {
          const attachmentPaths = attachmentsList.map(f => `${targetUserId}/${f.name}`);
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
