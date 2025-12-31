import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip',
};

// Rate limiting configuration
const RATE_LIMIT_MAX_ATTEMPTS = 5; // Max attempts per window
const RATE_LIMIT_WINDOW_MINUTES = 15; // Window in minutes
const LOCKOUT_DURATION_MINUTES = 30; // Lockout duration after exceeding limit

// Simple hash function using Web Crypto API
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

function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Extract IP address from request
function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') ||
         req.headers.get('cf-connecting-ip') ||
         'unknown';
}

// IP Geolocation lookup using ip-api.com (free, no API key needed)
interface GeoLocation {
  country: string | null;
  region: string | null;
  city: string | null;
}

async function getGeoLocation(ip: string): Promise<GeoLocation> {
  // Skip for localhost/private IPs
  if (ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || 
      ip.startsWith('10.') || ip.startsWith('172.') || ip === '::1') {
    return { country: null, region: null, city: null };
  }
  
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`);
    
    if (!response.ok) {
      console.log('Geolocation lookup failed:', response.status);
      return { country: null, region: null, city: null };
    }
    
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        country: data.country || null,
        region: data.regionName || null,
        city: data.city || null
      };
    }
    
    return { country: null, region: null, city: null };
  } catch (error) {
    console.error('Geolocation lookup error:', error);
    return { country: null, region: null, city: null };
  }
}

// Parse user agent to extract browser, OS, and device type
function parseUserAgent(ua: string | null): { browser: string; os: string; deviceType: string } {
  if (!ua) return { browser: 'Unbekannt', os: 'Unbekannt', deviceType: 'Unbekannt' };
  
  let browser = 'Unbekannt';
  let os = 'Unbekannt';
  let deviceType = 'Desktop';
  
  // Detect browser
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Opera/') || ua.includes('OPR/')) browser = 'Opera';
  
  // Detect OS
  if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
  else if (ua.includes('Windows NT')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('iPhone')) { os = 'iOS'; deviceType = 'Mobile'; }
  else if (ua.includes('iPad')) { os = 'iPadOS'; deviceType = 'Tablet'; }
  else if (ua.includes('Android')) { 
    os = 'Android'; 
    deviceType = ua.includes('Mobile') ? 'Mobile' : 'Tablet';
  }
  else if (ua.includes('Linux')) os = 'Linux';
  
  return { browser, os, deviceType };
}

// Check rate limiting for an IP address
async function checkRateLimit(supabase: any, ipAddress: string): Promise<{ allowed: boolean; remainingAttempts: number; lockedUntil?: Date }> {
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - RATE_LIMIT_WINDOW_MINUTES);
  
  // Get failed attempts in the window
  const { data: attempts, error } = await supabase
    .from('login_attempts')
    .select('*')
    .eq('ip_address', ipAddress)
    .eq('success', false)
    .gte('attempted_at', windowStart.toISOString())
    .order('attempted_at', { ascending: false });
  
  if (error) {
    console.error('Error checking rate limit:', error);
    return { allowed: true, remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS };
  }
  
  const failedCount = attempts?.length || 0;
  
  if (failedCount >= RATE_LIMIT_MAX_ATTEMPTS) {
    const lastAttempt = attempts[0];
    const lockoutEnd = new Date(lastAttempt.attempted_at);
    lockoutEnd.setMinutes(lockoutEnd.getMinutes() + LOCKOUT_DURATION_MINUTES);
    
    if (new Date() < lockoutEnd) {
      return { 
        allowed: false, 
        remainingAttempts: 0,
        lockedUntil: lockoutEnd
      };
    }
  }
  
  return { 
    allowed: true, 
    remainingAttempts: Math.max(0, RATE_LIMIT_MAX_ATTEMPTS - failedCount)
  };
}

// Record a login attempt
async function recordLoginAttempt(supabase: any, ipAddress: string, success: boolean): Promise<void> {
  await supabase.from('login_attempts').insert({
    ip_address: ipAddress,
    success,
    attempted_at: new Date().toISOString()
  });
  
  // Cleanup old attempts periodically (1 in 10 chance)
  if (Math.random() < 0.1) {
    await supabase.rpc('cleanup_old_login_attempts');
  }
}

// Log security event with enhanced details including geolocation
async function logSecurityEvent(
  supabase: any, 
  userId: string, 
  eventType: string, 
  details: Record<string, any>,
  req: Request
): Promise<void> {
  const ipAddress = getClientIP(req);
  const userAgent = req.headers.get('user-agent');
  const { browser, os, deviceType } = parseUserAgent(userAgent);
  const geo = await getGeoLocation(ipAddress);
  
  await supabase.from('security_logs').insert({
    user_id: userId,
    event_type: eventType,
    details,
    ip_address: ipAddress,
    user_agent: userAgent,
    browser,
    os,
    device_type: deviceType,
    country: geo.country,
    region: geo.region,
    city: geo.city
  });
}

// Create session and log to history
async function createSessionWithHistory(
  supabase: any, 
  userId: string, 
  isDecoy: boolean,
  req: Request
): Promise<string> {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  
  const ipAddress = getClientIP(req);
  const userAgent = req.headers.get('user-agent');
  const { browser, os, deviceType } = parseUserAgent(userAgent);
  
  // Cleanup old sessions for this user
  await supabase
    .from('vault_sessions')
    .delete()
    .eq('user_id', userId);
  
  // Mark old session history as inactive
  await supabase
    .from('session_history')
    .update({ is_active: false, logout_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_active', true);
  
  // Create new session
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
  
  // Get geolocation data
  const geo = await getGeoLocation(ipAddress);
  
  // Create session history entry with geolocation
  await supabase.from('session_history').insert({
    user_id: userId,
    ip_address: ipAddress,
    user_agent: userAgent,
    browser,
    os,
    device_type: deviceType,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    is_active: true
  });
  
  // Update user's last login info - first get current count
  const { data: currentUser } = await supabase
    .from('vault_users')
    .select('login_count')
    .eq('id', userId)
    .single();
  
  await supabase
    .from('vault_users')
    .update({
      last_login_at: new Date().toISOString(),
      last_login_ip: ipAddress,
      login_count: (currentUser?.login_count || 0) + 1
    })
    .eq('id', userId);
  
  return sessionToken;
}

// Validate session token
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
  
  await supabase
    .from('vault_sessions')
    .update({ last_activity: new Date().toISOString() })
    .eq('session_token', sessionToken);
  
  return { userId: data.user_id, isDecoy: data.is_decoy };
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, pin, newPin, recoveryKey, targetUserId, sessionToken, role } = body;
    const ipAddress = getClientIP(req);
    
    console.log(`PIN action requested: ${action} from IP: ${ipAddress}`);

    // Validate session for authenticated actions
    let authenticatedUser: { userId: string; isDecoy: boolean } | null = null;
    if (sessionToken) {
      authenticatedUser = await validateSession(supabase, sessionToken);
    }

    // ========== VERIFY PIN ==========
    if (action === 'verify') {
      // Check rate limiting first
      const rateLimitCheck = await checkRateLimit(supabase, ipAddress);
      
      if (!rateLimitCheck.allowed) {
        const lockedUntilStr = rateLimitCheck.lockedUntil 
          ? ` bis ${rateLimitCheck.lockedUntil.toLocaleTimeString('de-DE')}`
          : '';
        console.log(`Rate limited IP: ${ipAddress}`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Zu viele Fehlversuche. Bitte warten${lockedUntilStr}`,
            rateLimited: true,
            lockedUntil: rateLimitCheck.lockedUntil?.toISOString()
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        );
      }

      if (!pin || pin.length !== 6) {
        return new Response(
          JSON.stringify({ success: false, error: 'PIN muss 6 Ziffern haben' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const { data: users, error: fetchError } = await supabase
        .from('vault_users')
        .select('id, pin_hash, decoy_pin_hash');

      if (fetchError) {
        console.error('Database error:', fetchError);
        throw fetchError;
      }

      // Create default user if none exists
      if (!users || users.length === 0) {
        console.log('No user found, creating default user');
        const defaultHash = await hashPin('123456');

        const { data: newUser, error: createError } = await supabase
          .from('vault_users')
          .insert({ pin_hash: defaultHash })
          .select()
          .single();

        if (createError) throw createError;

        if (pin === '123456') {
          await recordLoginAttempt(supabase, ipAddress, true);
          await logSecurityEvent(supabase, newUser.id, 'login_success', { method: 'pin', isNewUser: true }, req);
          const token = await createSessionWithHistory(supabase, newUser.id, false, req);
          return new Response(
            JSON.stringify({ success: true, userId: newUser.id, isDecoy: false, sessionToken: token }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await recordLoginAttempt(supabase, ipAddress, false);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Falscher PIN',
            remainingAttempts: rateLimitCheck.remainingAttempts - 1
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find matching user
      for (const user of users) {
        // Check decoy PIN first
        if (user.decoy_pin_hash) {
          const isDecoy = await verifyPin(pin, user.decoy_pin_hash);
          if (isDecoy) {
            await recordLoginAttempt(supabase, ipAddress, true);
            await logSecurityEvent(supabase, user.id, 'decoy_login', { method: 'pin' }, req);
            const token = await createSessionWithHistory(supabase, user.id, true, req);
            return new Response(
              JSON.stringify({ success: true, userId: user.id, isDecoy: true, sessionToken: token }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        const isMain = await verifyPin(pin, user.pin_hash);
        if (isMain) {
          await recordLoginAttempt(supabase, ipAddress, true);
          await logSecurityEvent(supabase, user.id, 'login_success', { method: 'pin' }, req);
          const token = await createSessionWithHistory(supabase, user.id, false, req);
          return new Response(
            JSON.stringify({ success: true, userId: user.id, isDecoy: false, sessionToken: token }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Failed login
      await recordLoginAttempt(supabase, ipAddress, false);
      await logSecurityEvent(supabase, users[0].id, 'login_failed', { method: 'pin' }, req);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Falscher PIN',
          remainingAttempts: rateLimitCheck.remainingAttempts - 1
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== VERIFY RECOVERY KEY ==========
    else if (action === 'verify-recovery') {
      const rateLimitCheck = await checkRateLimit(supabase, ipAddress);
      
      if (!rateLimitCheck.allowed) {
        return new Response(
          JSON.stringify({ success: false, error: 'Zu viele Fehlversuche', rateLimited: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        );
      }

      const normalized = normalizeRecoveryKeyComparable(recoveryKey || '');
      if (!normalized || normalized.length < 10) {
        await recordLoginAttempt(supabase, ipAddress, false);
        return new Response(
          JSON.stringify({ success: false, error: 'Ungültiger Recovery-Key' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: candidates, error: fetchError } = await supabase
        .from('vault_users')
        .select('id, recovery_key')
        .not('recovery_key', 'is', null);

      if (fetchError) throw fetchError;

      const matched = (candidates || []).find((u: any) => {
        const stored = u.recovery_key as string | null;
        return stored ? normalizeRecoveryKeyComparable(stored) === normalized : false;
      });

      if (!matched) {
        await recordLoginAttempt(supabase, ipAddress, false);
        return new Response(
          JSON.stringify({ success: false, error: 'Recovery-Key nicht gefunden' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await recordLoginAttempt(supabase, ipAddress, true);
      await logSecurityEvent(supabase, matched.id, 'login_success', { method: 'recovery_key' }, req);
      const token = await createSessionWithHistory(supabase, matched.id, false, req);
      
      return new Response(
        JSON.stringify({ success: true, userId: matched.id, isDecoy: false, sessionToken: token }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ========== VALIDATE SESSION ==========
    else if (action === 'validate-session') {
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

    // ========== LOGOUT ==========
    else if (action === 'logout') {
      if (sessionToken) {
        // Get user before deleting session
        const { data: session } = await supabase
          .from('vault_sessions')
          .select('user_id')
          .eq('session_token', sessionToken)
          .single();
        
        if (session) {
          await logSecurityEvent(supabase, session.user_id, 'logout', {}, req);
          
          // Mark session history as inactive
          await supabase
            .from('session_history')
            .update({ is_active: false, logout_at: new Date().toISOString() })
            .eq('user_id', session.user_id)
            .eq('is_active', true);
        }
        
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
    
    // ========== CHANGE PIN ==========
    else if (action === 'change') {
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
        await logSecurityEvent(supabase, authenticatedUser.userId, 'pin_change_failed', { reason: 'wrong_current_pin' }, req);
        return new Response(
          JSON.stringify({ success: false, error: 'Aktueller PIN ist falsch' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      const newHash = await hashPin(newPin);
      const { error: updateError } = await supabase
        .from('vault_users')
        .update({ pin_hash: newHash, updated_at: new Date().toISOString() })
        .eq('id', authenticatedUser.userId);

      if (updateError) throw updateError;

      await logSecurityEvent(supabase, authenticatedUser.userId, 'pin_changed', {}, req);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== SET DECOY PIN ==========
    else if (action === 'set-decoy') {
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

      const decoyHash = await hashPin(newPin);
      const { error: updateError } = await supabase
        .from('vault_users')
        .update({ decoy_pin_hash: decoyHash, updated_at: new Date().toISOString() })
        .eq('id', authenticatedUser.userId);

      if (updateError) throw updateError;

      await logSecurityEvent(supabase, authenticatedUser.userId, 'decoy_pin_set', {}, req);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== CREATE USER (Admin) ==========
    else if (action === 'create-user') {
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

      // Check if PIN is already in use
      const { data: existingUsers } = await supabase
        .from('vault_users')
        .select('id, pin_hash, decoy_pin_hash');

      if (existingUsers) {
        for (const user of existingUsers) {
          const isMainPin = await verifyPin(pin, user.pin_hash);
          if (isMainPin) {
            return new Response(
              JSON.stringify({ success: false, error: 'Dieser PIN wird bereits verwendet' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }
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

      const generatedRecoveryKey = `${crypto.randomUUID().slice(0, 4)}-${crypto.randomUUID().slice(0, 4)}-${crypto.randomUUID().slice(0, 4)}-${crypto.randomUUID().slice(0, 4)}`.toUpperCase();
      const pinHash = await hashPin(pin);
      
      const { data: newUser, error: createError } = await supabase
        .from('vault_users')
        .insert({ pin_hash: pinHash, recovery_key: generatedRecoveryKey })
        .select()
        .single();

      if (createError) throw createError;

      await logSecurityEvent(supabase, authenticatedUser.userId, 'user_created', { newUserId: newUser.id }, req);
      
      return new Response(
        JSON.stringify({ success: true, userId: newUser.id, recoveryKey: generatedRecoveryKey }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== ADMIN RESET PIN ==========
    else if (action === 'admin-reset-pin') {
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

      const newHash = await hashPin(newPin);
      const { error: updateError } = await supabase
        .from('vault_users')
        .update({ pin_hash: newHash, updated_at: new Date().toISOString() })
        .eq('id', targetUserId);

      if (updateError) throw updateError;

      await logSecurityEvent(supabase, authenticatedUser.userId, 'admin_reset_pin', { targetUserId }, req);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== ADMIN DELETE USER ==========
    else if (action === 'admin-delete-user') {
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

      if (targetUserId === authenticatedUser.userId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Du kannst dich nicht selbst löschen' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const deletionOrder = [
        'note_attachments', 'note_versions', 'view_history', 'security_logs', 
        'vault_sessions', 'session_history', 'login_attempts',
        'notes', 'photos', 'files', 'links', 'tiktok_videos', 'secret_texts',
        'shared_album_items', 'shared_album_access', 'shared_albums',
        'note_folders', 'link_folders', 'tiktok_folders', 'albums', 'file_albums',
        'tags', 'user_roles', 'vault_users'
      ];

      for (const table of deletionOrder) {
        const column = table === 'vault_users' ? 'id' : 
                      table === 'shared_albums' ? 'owner_id' : 
                      table === 'login_attempts' ? 'ip_address' : 'user_id';
        
        if (table === 'login_attempts') continue; // Skip, not user-specific by ID
        
        const { error } = await supabase
          .from(table)
          .delete()
          .eq(column, targetUserId);
        
        if (error) console.error(`Error deleting from ${table}:`, error);
      }

      // Delete storage files
      try {
        for (const bucket of ['photos', 'files', 'note-attachments']) {
          const { data: files } = await supabase.storage.from(bucket).list(targetUserId);
          if (files?.length) {
            const paths = files.map((f: any) => `${targetUserId}/${f.name}`);
            await supabase.storage.from(bucket).remove(paths);
          }
        }
      } catch (storageError) {
        console.error('Error deleting storage:', storageError);
      }

      await logSecurityEvent(supabase, authenticatedUser.userId, 'user_deleted', { deletedUserId: targetUserId }, req);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== ADMIN ASSIGN ROLE ==========
    else if (action === 'admin-assign-role') {
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

      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: targetUserId, role });

      if (insertError) throw insertError;

      await logSecurityEvent(supabase, authenticatedUser.userId, 'role_assigned', { targetUserId, role }, req);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== ADMIN REMOVE ROLE ==========
    else if (action === 'admin-remove-role') {
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

      if (targetUserId === authenticatedUser.userId && role === 'admin') {
        return new Response(
          JSON.stringify({ success: false, error: 'Du kannst dir nicht selbst die Admin-Rolle entziehen' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', targetUserId)
        .eq('role', role);

      if (deleteError) throw deleteError;

      await logSecurityEvent(supabase, authenticatedUser.userId, 'role_removed', { targetUserId, role }, req);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== GET USER ROLES ==========
    else if (action === 'get-user-roles') {
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

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, roles: roles || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== ADMIN GET ALL ROLES ==========
    else if (action === 'admin-get-all-roles') {
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

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, roles: roles || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== GET SESSION HISTORY (Admin) ==========
    else if (action === 'admin-get-session-history') {
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

      const { data: sessions, error } = await supabase
        .from('session_history')
        .select('*')
        .order('login_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, sessions: sessions || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== GET SECURITY LOGS (Admin) ==========
    else if (action === 'admin-get-security-logs') {
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

      const { data: logs, error } = await supabase
        .from('security_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, logs: logs || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== TERMINATE USER SESSIONS (Admin) ==========
    else if (action === 'admin-terminate-sessions') {
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

      // Delete all sessions for the user
      await supabase
        .from('vault_sessions')
        .delete()
        .eq('user_id', targetUserId);

      // Mark session history as inactive
      await supabase
        .from('session_history')
        .update({ is_active: false, logout_at: new Date().toISOString() })
        .eq('user_id', targetUserId)
        .eq('is_active', true);

      await logSecurityEvent(supabase, authenticatedUser.userId, 'sessions_terminated', { targetUserId }, req);
      
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
