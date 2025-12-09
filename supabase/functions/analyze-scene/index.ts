import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sceneContent, sceneNumber, projectId, visualStyle } = await req.json();
    
    console.log(`Analyzing scene ${sceneNumber} for project ${projectId}`);

    // Validation: Skip if scene is empty
    if (!sceneContent || sceneContent.trim().length < 5) {
      console.log(`Scene ${sceneNumber} is too short, marking as SKIPPED`);
      return new Response(
        JSON.stringify({ 
          error: 'Scene too short', 
          status: 'SKIPPED',
          analysis: JSON.stringify({
            story_analysis: { stakes: 'N/A', ownership: 'N/A', breaking_point: 'N/A', key_props: 'N/A' },
            producing_logistics: { red_flags: [], resource_impact: 'Low', departments_affected: [] },
            directing_vision: { visual_metaphor: 'N/A', editorial_intent: 'N/A', shot_motivation: 'N/A' },
            shot_list: []
          })
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    let systemPrompt = `You are a veteran Director of Photography and Film Editor analyzing screenplay scenes. Return ONLY valid JSON with this exact structure:

{
  "story_analysis": { "stakes": "string", "ownership": "string", "breaking_point": "string", "key_props": "string" },
  "producing_logistics": { "red_flags": ["string"], "resource_impact": "Low|Medium|High", "departments_affected": ["string"] },
  "directing_vision": { 
    "visual_metaphor": "Technical visual approach (lighting, lens, color). NO abstract emotions.",
    "editorial_intent": "Pacing and cut strategy.",
    "shot_motivation": "Why move from shot A to B?"
  },
  "shot_list": [
    {
      "shot_type": "Wide|MCU|CU|etc",
      "visual": "Description",
      "rationale": "Why this shot?",
      "image_prompt": "Detailed AI prompt: [Shot Size] of [Subject] [Action], [Lighting], [Angle], cinematic, 8k, --ar 16:9"
    }
  ]
}

CRITICAL TONE RULE for 'directing_vision' section: Write like a working DP or Editor on set. Be concise, technical, and actionable. Avoid flowery language, emotional adjectives, or abstract metaphors. Use industry-standard terminology. Focus on camera, lighting, lens, blocking, and cutting—NOT on feelings or emotions.

// NEW SHOT CONSTRAINT: Focus on thorough coverage, not just minimalism.
CRITICAL SHOT CONSTRAINT: The shot list must ensure comprehensive narrative coverage of the entire scene, including all character reactions, turning points, and blocking. Generate between 5 and 8 shots for simple scenes (e.g., establishing shots) and between 8 and 15 shots for complex scenes (e.g., dialogue or action sequences). Prioritize complete coverage over efficiency.`;

    if (visualStyle && visualStyle.trim()) {
      systemPrompt += `\n\nCRITICAL: All image_prompts MUST adhere to the following visual style: "${visualStyle}". Append these style keywords to every image_prompt you generate. Every single image_prompt must include this visual aesthetic.`;
    }

    // Call OpenAI
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this screenplay scene:\n\n${sceneContent}` }
        ],
        response_format: { type: "json_object" }
      }),
    });
    // ... rest of the function remains the same ...
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', aiResponse.status, errorText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let analysisText = aiData.choices?.[0]?.message?.content || '{}';
    
    console.log('Raw OpenAI response:', analysisText);

    // Sanitize and Parse
    if (analysisText.startsWith('```')) {
      analysisText = analysisText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '');
    }
    
    const analysisJson = JSON.parse(analysisText);

    return new Response(
      JSON.stringify({ 
        analysis: JSON.stringify(analysisJson), 
        status: 'COMPLETED'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-scene:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});