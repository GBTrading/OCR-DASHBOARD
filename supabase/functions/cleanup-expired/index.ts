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
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    console.log('Starting cleanup of expired sessions...')

    // Call the database function to get expired sessions and clean them up
    const { data: expiredSessions, error: cleanupError } = await supabase
      .rpc('cleanup_expired_sessions')

    if (cleanupError) {
      console.error('Database cleanup error:', cleanupError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to cleanup expired sessions',
          details: cleanupError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Found ${expiredSessions?.length || 0} expired sessions to cleanup`)

    // Clean up associated files from Supabase Storage
    const deletionResults = []
    let successfulDeletions = 0
    let failedDeletions = 0

    if (expiredSessions && expiredSessions.length > 0) {
      for (const session of expiredSessions) {
        const { session_id, file_path_to_delete } = session

        if (file_path_to_delete) {
          try {
            // Extract bucket and file path
            // Assuming file_path format: "temp-uploads/session-id/filename.jpg"
            const pathParts = file_path_to_delete.split('/')
            const bucket = pathParts[0] // temp-uploads
            const filePath = pathParts.slice(1).join('/') // session-id/filename.jpg

            const { error: deleteError } = await supabase.storage
              .from(bucket)
              .remove([filePath])

            if (deleteError) {
              console.error(`Failed to delete file ${file_path_to_delete}:`, deleteError)
              failedDeletions++
              deletionResults.push({
                sessionId: session_id,
                filePath: file_path_to_delete,
                success: false,
                error: deleteError.message
              })
            } else {
              console.log(`Successfully deleted file: ${file_path_to_delete}`)
              successfulDeletions++
              deletionResults.push({
                sessionId: session_id,
                filePath: file_path_to_delete,
                success: true
              })
            }
          } catch (error) {
            console.error(`Error processing file deletion for ${file_path_to_delete}:`, error)
            failedDeletions++
            deletionResults.push({
              sessionId: session_id,
              filePath: file_path_to_delete,
              success: false,
              error: error.message
            })
          }
        }
      }
    }

    const summary = {
      sessionsProcessed: expiredSessions?.length || 0,
      filesDeleted: successfulDeletions,
      fileDeletionFailures: failedDeletions,
      cleanupTime: new Date().toISOString()
    }

    console.log('Cleanup completed:', summary)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cleanup completed successfully',
        summary,
        details: deletionResults
      }),
      { 
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