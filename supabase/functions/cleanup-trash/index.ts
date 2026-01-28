import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cleanup-key',
}

const TRASH_RETENTION_DAYS = 30

// Secret key for authorizing cleanup operations
// This should match an environment variable or be called only by scheduled jobs
const CLEANUP_SECRET_KEY = Deno.env.get('CLEANUP_SECRET_KEY') || 'internal-cleanup-key-' + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.substring(0, 16)

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Security: Verify authorization
  // Accept either:
  // 1. The cleanup secret key in x-cleanup-key header
  // 2. A valid admin session token
  // 3. Service role key in Authorization header (for cron jobs)
  const cleanupKey = req.headers.get('x-cleanup-key')
  const authHeader = req.headers.get('authorization')
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  let isAuthorized = false
  
  // Check cleanup secret key
  if (cleanupKey === CLEANUP_SECRET_KEY) {
    isAuthorized = true
    console.log('Authorized via cleanup secret key')
  }
  
  // Check if called with service role key (for cron/scheduled jobs)
  if (!isAuthorized && authHeader?.includes(supabaseServiceKey)) {
    isAuthorized = true
    console.log('Authorized via service role key')
  }
  
  // Check for admin session token
  if (!isAuthorized) {
    const sessionToken = req.headers.get('x-session-token')
    if (sessionToken) {
      const supabaseCheck = createClient(supabaseUrl, supabaseServiceKey)
      
      // Validate session and check admin role
      const { data: session } = await supabaseCheck
        .from('vault_sessions')
        .select('user_id, expires_at')
        .eq('session_token', sessionToken)
        .single()
      
      if (session && new Date(session.expires_at) > new Date()) {
        const { data: adminRole } = await supabaseCheck
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user_id)
          .eq('role', 'admin')
          .single()
        
        if (adminRole) {
          isAuthorized = true
          console.log('Authorized via admin session')
        }
      }
    }
  }
  
  if (!isAuthorized) {
    console.log('Unauthorized cleanup attempt')
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Admin access required' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    )
  }

  console.log('Starting trash cleanup job...')

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - TRASH_RETENTION_DAYS)
    const cutoffDateStr = cutoffDate.toISOString()
    
    console.log(`Deleting items deleted before: ${cutoffDateStr}`)

    let deletedNotes = 0
    let deletedPhotos = 0
    let deletedFiles = 0

    // Delete expired notes
    const { data: expiredNotes, error: notesError } = await supabase
      .from('notes')
      .select('id, user_id')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffDateStr)

    if (notesError) {
      console.error('Error fetching expired notes:', notesError)
    } else if (expiredNotes && expiredNotes.length > 0) {
      const { error: deleteNotesError } = await supabase
        .from('notes')
        .delete()
        .in('id', expiredNotes.map(n => n.id))
      
      if (deleteNotesError) {
        console.error('Error deleting notes:', deleteNotesError)
      } else {
        deletedNotes = expiredNotes.length
        console.log(`Deleted ${deletedNotes} expired notes`)
      }
    }

    // Delete expired photos (with storage cleanup)
    const { data: expiredPhotos, error: photosError } = await supabase
      .from('photos')
      .select('id, user_id, filename')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffDateStr)

    if (photosError) {
      console.error('Error fetching expired photos:', photosError)
    } else if (expiredPhotos && expiredPhotos.length > 0) {
      // Delete from storage first
      for (const photo of expiredPhotos) {
        if (photo.filename && photo.user_id) {
          const { error: storageError } = await supabase.storage
            .from('photos')
            .remove([`${photo.user_id}/${photo.filename}`])
          
          if (storageError) {
            console.error(`Error deleting photo from storage: ${photo.filename}`, storageError)
          }
        }
      }
      
      // Then delete from database
      const { error: deletePhotosError } = await supabase
        .from('photos')
        .delete()
        .in('id', expiredPhotos.map(p => p.id))
      
      if (deletePhotosError) {
        console.error('Error deleting photos:', deletePhotosError)
      } else {
        deletedPhotos = expiredPhotos.length
        console.log(`Deleted ${deletedPhotos} expired photos`)
      }
    }

    // Delete expired files (with storage cleanup)
    const { data: expiredFiles, error: filesError } = await supabase
      .from('files')
      .select('id, user_id, filename')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoffDateStr)

    if (filesError) {
      console.error('Error fetching expired files:', filesError)
    } else if (expiredFiles && expiredFiles.length > 0) {
      // Delete from storage first
      for (const file of expiredFiles) {
        if (file.filename && file.user_id) {
          const { error: storageError } = await supabase.storage
            .from('files')
            .remove([`${file.user_id}/${file.filename}`])
          
          if (storageError) {
            console.error(`Error deleting file from storage: ${file.filename}`, storageError)
          }
        }
      }
      
      // Then delete from database
      const { error: deleteFilesError } = await supabase
        .from('files')
        .delete()
        .in('id', expiredFiles.map(f => f.id))
      
      if (deleteFilesError) {
        console.error('Error deleting files:', deleteFilesError)
      } else {
        deletedFiles = expiredFiles.length
        console.log(`Deleted ${deletedFiles} expired files`)
      }
    }

    const result = {
      success: true,
      deleted: {
        notes: deletedNotes,
        photos: deletedPhotos,
        files: deletedFiles,
        total: deletedNotes + deletedPhotos + deletedFiles
      },
      cutoffDate: cutoffDateStr
    }

    console.log('Trash cleanup completed:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Trash cleanup error:', error)
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
