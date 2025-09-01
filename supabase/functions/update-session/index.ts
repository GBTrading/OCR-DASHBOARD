import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateSessionRequest {
  sessionId: string
  status: 'scanned' | 'uploaded'
  filePath?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key for bypassing RLS when needed
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Parse request body
    const body: UpdateSessionRequest = await req.json()
    const { sessionId, status, filePath } = body

    // Validate required fields
    if (!sessionId || !status) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId, status' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate status values
    if (!['scanned', 'uploaded'].includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid status. Must be "scanned" or "uploaded"' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if session exists and is not expired
    const { data: session, error: fetchError } = await supabase
      .from('cross_device_sessions')
      .select('id, status, expires_at, user_id')
      .eq('id', sessionId)
      .single()

    if (fetchError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found or expired' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if session has expired
    if (new Date() > new Date(session.expires_at)) {
      return new Response(
        JSON.stringify({ error: 'Session has expired' }),
        { 
          status: 410, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      'pending': ['scanned'],
      'scanned': ['uploaded'],
      'uploaded': [], // No further transitions allowed
      'completed': [], // No further transitions allowed
      'expired': [] // No further transitions allowed
    }

    if (!validTransitions[session.status]?.includes(status)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid status transition from "${session.status}" to "${status}"` 
        }),
        { 
          status: 422, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Prepare update data
    const updateData: any = { 
      status,
      // Extend expiration by 5 minutes for active sessions
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    }

    // Add file path if provided (for uploaded status)
    if (status === 'uploaded' && filePath) {
      updateData.file_path = filePath
    }

    // Update the session
    const { error: updateError } = await supabase
      .from('cross_device_sessions')
      .update(updateData)
      .eq('id', sessionId)

    if (updateError) {
      console.error('Failed to update session:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update session' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Log successful update
    console.log(`Session ${sessionId} updated to status: ${status}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionId,
        status,
        message: 'Session updated successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Update session error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})