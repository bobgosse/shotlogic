import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sceneContent, sceneNumber, projectId, previousSceneAnalysis } = await req.json();
    
    console.log(`Analyzing scene ${sceneNumber} for project ${projectId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const startTime = Date.now();

    // Update scene start time
    await supabase
      .from('scenes')
      .update({ 
        analysis_started_at: new Date().toISOString(),
        status: 'analyzing'
      })
      .eq('project_id', projectId)
      .eq('scene_number', sceneNumber);

    // Step 1: Parsing dialogue
    await supabase
      .from('projects')
      .update({ analysis_step: 'Parsing dialogue...' })
      .eq('id', projectId);

    if (!sceneContent || sceneContent.trim().length < 5) {
      console.log(`Scene ${sceneNumber} is too short (less than 5 characters), marking as SKIPPED`);
      
      await supabase
        .from('scenes')
        .update({
          status: 'SKIPPED',
          analysis: JSON.stringify({
            story_analysis: {
              stakes: 'Scene content insufficient for analysis',
              ownership: 'N/A',
              breaking_point: 'N/A',
              key_props: 'N/A'
            },
            producing_logistics: {
              red_flags: [],
              resource_impact: 'Low',
              departments_affected: []
            },
            directing_vision: {
              visual_metaphor: 'N/A',
              editorial_intent: 'N/A',
              shot_motivation: 'N/A'
            }
          }),
          analysis_completed_at: new Date().toISOString()
        })
        .eq('project_id', projectId)
        .eq('scene_number', sceneNumber);

      return new Response(
        JSON.stringify({ 
          error: 'Scene too short', 
          status: 'SKIPPED',
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Step 2: Identifying conflict
    await supabase
      .from('projects')
      .update({ analysis_step: 'Identifying conflict...' })
      .eq('id', projectId);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Step 3: Mapping scene arc
    await supabase
      .from('projects')
      .update({ analysis_step: 'Mapping scene arc...' })
      .eq('id', projectId);

    const messages = [
      {
        role: 'user',
        content: `You are a veteran Film Editor, Director, and Producer. Analyze this screenplay scene with strict narrative awareness. Consider Coverage Potential, conflict engines, production logistics, and directorial vision.

CRITICAL NARRATIVE RULES:

1. GLOBAL CONTEXT (Crucial):
   - Respect Title Cards: If the script establishes a time or place (e.g., 'New York 1918'), apply that context to EVERY scene.
   - Historical Lens: If the era is 1918, analyze tone and behavior through that lens (e.g., impact of World War I, the Flu Pandemic, social constraints of the era).

2. CHARACTER CONTINUITY:
   - NEVER Re-Introduce Characters: If a character appeared in previous scenes, DO NOT introduce them again.
   - Track Evolution: Analyze how THIS scene advances their arc from where we last saw them.

3. PREVIOUS SCENE CONTEXT:
${previousSceneAnalysis ? `   - Previous Scene Summary: ${previousSceneAnalysis}\n   - Use this context to understand narrative continuity and character progression.` : '   - This is the first scene being analyzed.'}

SCENE TO ANALYZE:
${sceneContent}`
      }
    ];

    // Step 4: Generating shot coverage
    await supabase
      .from('projects')
      .update({ analysis_step: 'Generating shot coverage...' })
      .eq('id', projectId);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "scene_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                story_analysis: {
                  type: "object",
                  properties: {
                    stakes: {
                      type: "string",
                      description: "What is at risk in this scene? What will characters gain or lose?"
                    },
                    ownership: {
                      type: "string",
                      description: "Who drives this scene? Whose need is clearest?"
                    },
                    breaking_point: {
                      type: "string",
                      description: "The exact moment or line where the scene pivots. Quote dialogue or describe the action."
                    },
                    key_props: {
                      type: "string",
                      description: "Physical objects that carry meaning or advance the story (guns, letters, phones, etc.)"
                    }
                  },
                  required: ["stakes", "ownership", "breaking_point", "key_props"],
                  additionalProperties: false
                },
                producing_logistics: {
                  type: "object",
                  properties: {
                    red_flags: {
                      type: "array",
                      items: { type: "string" },
                      description: "Production challenges (stunts, VFX, night shoots, child actors, animals, crowds, etc.)"
                    },
                    resource_impact: {
                      type: "string",
                      enum: ["Low", "Medium", "High"],
                      description: "Overall production complexity and budget impact"
                    },
                    departments_affected: {
                      type: "array",
                      items: { type: "string" },
                      description: "Which departments need coordination (Camera, Grip, Electric, Wardrobe, Props, VFX, Stunts, etc.)"
                    }
                  },
                  required: ["red_flags", "resource_impact", "departments_affected"],
                  additionalProperties: false
                },
                directing_vision: {
                  type: "object",
                  properties: {
                    visual_metaphor: {
                      type: "string",
                      description: "Visual theme or symbolic approach (trapped in frames, shadows consuming light, mirror imagery, etc.)"
                    },
                    editorial_intent: {
                      type: "string",
                      description: "How should this scene CUT? Pacing strategy (build tension through coverage, quick cuts on confrontation, linger on silences, etc.)"
                    },
                    shot_motivation: {
                      type: "string",
                      description: "Why does the camera move or why is each shot needed? What emotional shift justifies the cut?"
                    }
                  },
                  required: ["visual_metaphor", "editorial_intent", "shot_motivation"],
                  additionalProperties: false
                }
              },
              required: ["story_analysis", "producing_logistics", "directing_vision"],
              additionalProperties: false
            }
          }
        }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysisText = aiData.choices?.[0]?.message?.content || '{}';
    
    // Parse the structured JSON response
    let analysisJson;
    try {
      analysisJson = JSON.parse(analysisText);
      
      // Validate structure
      if (!analysisJson.story_analysis || !analysisJson.producing_logistics || !analysisJson.directing_vision) {
        throw new Error('Invalid analysis structure');
      }
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      analysisJson = {
        story_analysis: {
          stakes: 'Unable to parse',
          ownership: 'Unable to parse',
          breaking_point: 'Unable to parse',
          key_props: 'N/A'
        },
        producing_logistics: {
          red_flags: [],
          resource_impact: 'Low',
          departments_affected: []
        },
        directing_vision: {
          visual_metaphor: 'Unable to parse',
          editorial_intent: 'Unable to parse',
          shot_motivation: 'Unable to parse'
        }
      };
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Update scene completion
    await supabase
      .from('scenes')
      .update({
        analysis: JSON.stringify(analysisJson),
        status: 'COMPLETED',
        analysis_completed_at: new Date().toISOString()
      })
      .eq('project_id', projectId)
      .eq('scene_number', sceneNumber);

    // Update project average time
    const { data: project } = await supabase
      .from('projects')
      .select('average_scene_time_ms, current_scene')
      .eq('id', projectId)
      .single();

    if (project) {
      const completedScenes = sceneNumber;
      const oldAvg = project.average_scene_time_ms || 0;
      const newAvg = Math.round((oldAvg * (completedScenes - 1) + duration) / completedScenes);

      await supabase
        .from('projects')
        .update({ 
          average_scene_time_ms: newAvg,
          analysis_step: 'idle'
        })
        .eq('id', projectId);
    }

    console.log(`Successfully analyzed scene ${sceneNumber} in ${duration}ms`);

    return new Response(
      JSON.stringify({ 
        analysis: JSON.stringify(analysisJson),
        status: 'COMPLETED',
        duration_ms: duration
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Error in analyze-scene-with-progress:', error);
    
    // Increment retry count
    const { projectId, sceneNumber } = await req.json();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from('scenes')
      .update({ 
        retry_count: supabase.rpc('increment', { row_id: sceneNumber }),
        status: 'ERROR'
      })
      .eq('project_id', projectId)
      .eq('scene_number', sceneNumber);

    return new Response(
      JSON.stringify({ 
        error: error.message,
        status: 'ERROR',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
