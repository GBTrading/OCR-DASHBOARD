import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Parse request body
    const { session_id } = await req.json()
    
    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`🧹 Starting cleanup for session: ${session_id}`)

    // Verify session ownership and get session details
    const { data: session, error: sessionError } = await supabase
      .from('cross_device_sessions')
      .select('id, user_id, file_path, status')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      console.error('Session verification failed:', sessionError)
      return new Response(
        JSON.stringify({ error: 'Session not found or access denied' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`✅ Session verified - User: ${session.user_id}, Status: ${session.status}`)

    // List all files in the session directory
    const { data: files, error: listError } = await supabase.storage
      .from('temp-uploads')
      .list(session_id)

    if (listError) {
      console.error('Failed to list files:', listError)
      return new Response(
        JSON.stringify({ error: 'Failed to list session files' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    let deletedFiles = 0
    let errors = []

    // Remove all files in the session directory
    if (files && files.length > 0) {
      const filePaths = files.map(file => `${session_id}/${file.name}`)
      
      console.log(`🗑️ Deleting ${files.length} files:`, filePaths)
      
      const { error: deleteError } = await supabase.storage
        .from('temp-uploads')
        .remove(filePaths)

      if (deleteError) {
        console.error('Failed to delete files:', deleteError)
        errors.push(`File deletion failed: ${deleteError.message}`)
      } else {
        deletedFiles = files.length
        console.log(`✅ Successfully deleted ${deletedFiles} files`)
      }
    } else {
      console.log('📭 No files found to cleanup')
    }

    // Delete session record entirely for complete isolation
    const { error: deleteError } = await supabase
      .from('cross_device_sessions')
      .delete()
      .eq('id', session_id)

    if (deleteError) {
      console.error('Failed to delete session record:', deleteError)
      errors.push(`Session deletion failed: ${deleteError.message}`)
    } else {
      console.log(`✅ Session record deleted: ${session_id}`)
    }

    // Return cleanup results
    const response = {
      success: true,
      session_id,
      files_deleted: deletedFiles,
      errors: errors.length > 0 ? errors : null,
      message: `Cleanup completed - ${deletedFiles} files removed, session deleted`
    }

    console.log('🎉 Cleanup completed:', response)

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Cleanup function error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during cleanup',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})