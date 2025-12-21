import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, pin, newPin, userId } = await req.json();
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

      // Get user from database
      const { data: users, error: fetchError } = await supabase
        .from('vault_users')
        .select('id, pin_hash')
        .limit(1);

      if (fetchError) {
        console.error('Database error:', fetchError);
        throw fetchError;
      }

      // If no user exists, create default user with PIN 123456
      if (!users || users.length === 0) {
        console.log('No user found, creating default user with PIN 123456');
        const defaultHash = await bcrypt.hash('123456');
        
        const { data: newUser, error: createError } = await supabase
          .from('vault_users')
          .insert({ pin_hash: defaultHash })
          .select()
          .single();

        if (createError) {
          console.error('Error creating default user:', createError);
          throw createError;
        }

        // Check if entered PIN matches default
        if (pin === '123456') {
          console.log('Login successful with default PIN');
          return new Response(
            JSON.stringify({ success: true, userId: newUser.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.log('Wrong PIN for default user');
          return new Response(
            JSON.stringify({ success: false, error: 'Falscher PIN' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
          );
        }
      }

      const user = users[0];
      
      // Verify PIN with bcrypt
      const isValid = await bcrypt.compare(pin, user.pin_hash);
      
      if (isValid) {
        console.log('PIN verification successful');
        return new Response(
          JSON.stringify({ success: true, userId: user.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.log('PIN verification failed');
        return new Response(
          JSON.stringify({ success: false, error: 'Falscher PIN' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }
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

      const isValid = await bcrypt.compare(pin, user.pin_hash);
      if (!isValid) {
        console.log('Current PIN verification failed');
        return new Response(
          JSON.stringify({ success: false, error: 'Aktueller PIN ist falsch' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      // Hash new PIN and update
      const newHash = await bcrypt.hash(newPin);
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
