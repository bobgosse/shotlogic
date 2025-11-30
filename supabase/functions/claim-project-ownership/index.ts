import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[claim-project-ownership] Starting ownership transfer...');

    // Get the authenticated user from the JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create Supabase client with service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the current user from the JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('[claim-project-ownership] Auth error:', userError);
      throw new Error('User not authenticated');
    }

    console.log('[claim-project-ownership] Transferring projects to user:', user.id);

    // Update all projects to belong to the current user (using admin client to bypass RLS)
    const { data: projects, error: updateError } = await supabaseAdmin
      .from('projects')
      .update({ user_id: user.id })
      .neq('user_id', user.id) // Only update projects that don't already belong to this user
      .select('id, title');

    if (updateError) {
      console.error('[claim-project-ownership] Update error:', updateError);
      throw updateError;
    }

    console.log('[claim-project-ownership] Successfully transferred projects:', projects?.length || 0);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully claimed ownership of ${projects?.length || 0} project(s)`,
        projects: projects
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[claim-project-ownership] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
