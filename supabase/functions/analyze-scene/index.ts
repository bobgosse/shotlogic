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

    if (!sceneContent || sceneContent.trim().length < 5) {
      console.log(`Scene ${sceneNumber} is too short (less than 5 characters), marking as SKIPPED`);
      return new Response(
        JSON.stringify({ 
          error: 'Scene too short', 
          status: 'SKIPPED',
          analysis: JSON.stringify({
            story_analysis: {
              stakes: 'Scene too short for analysis',
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
            },
            shot_list: []
          })
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build system prompt with visual style if provided
    let systemPrompt = `You are a veteran Director of Photography and Film Editor analyzing screenplay scenes. Return ONLY valid JSON with this exact structure:

{
  "story_analysis": {
    "stakes": "What's at risk in this scene? What will the character lose if they fail?",
    "ownership": "Who is the protagonist of this scene? Whose scene is it?",
    "breaking_point": "The exact moment where the scene's dramatic tension peaks. Quote dialogue or describe the action.",
    "key_props": "Physical objects that carry narrative weight or symbolism"
  },
  "producing_logistics": {
    "red_flags": ["List specific production challenges: stunts, VFX, crowd scenes, weather dependencies, etc."],
    "resource_impact": "Low | Medium | High",
    "departments_affected": ["List departments: Camera, Art Dept, Stunts, VFX, Wardrobe, etc."]
  },
  "directing_vision": {
    "visual_metaphor": "Technical visual approach using concrete filmmaking references. Specify: lighting setup (high-key/low-key/natural), lens choice (wide/telephoto/shallow DOF), color palette (warm/cool/desaturated), camera movement (static/handheld/Steadicam), blocking patterns, visual references (e.g., 'Wes Anderson symmetry', 'Fincher darkness', 'handheld chaos'). NO abstract emotions—only technical execution.",
    "editorial_intent": "Editing rhythm and cut strategy. Specify: pacing (slow/fast/staccato), cut types (hard cuts/match cuts/cross-cutting/jump cuts), shot duration (hold frames/quick cuts), transition style. Focus on HOW the scene cuts together, not what it 'feels' like.",
    "shot_motivation": "Technical reason for each cut. Why does the editor move from shot A to shot B? What new information, reaction, or spatial relationship does each cut reveal?"
  },
  "shot_list": [
    {
      "shot_type": "Wide Master | MCU | CU | OTS | Insert | etc.",
      "visual": "Describe what we see in the frame",
      "rationale": "Why the editor needs this shot - what it reveals",
      "image_prompt": "AI image generation prompt: [Shot Size] of [Subject] [Action], [Lighting Style], [Camera Angle], cinematic, photorealistic, 8k, --ar 16:9. Use the scene's Visual Metaphor to inform lighting and mood."
    }
  ]
}

CRITICAL TONE RULE for 'directing_vision' section: Write like a working DP or Editor on set. Be concise, technical, and actionable. Avoid flowery language, emotional adjectives, or abstract metaphors. Use industry-standard terminology. Focus on camera, lighting, lens, blocking, and cutting—NOT on feelings or emotions.

Important: For each shot in the shot_list, generate a detailed AI image generation prompt in the image_prompt field. Format: [Shot Size] of [Subject] [Action], [Lighting Style], [Camera Angle], cinematic, photorealistic, 8k, --ar 16:9. Use the Visual Metaphor from directing_vision to inform lighting and mood keywords.`;

    // Add visual style instruction if provided
    if (visualStyle && visualStyle.trim()) {
      systemPrompt += `\n\nCRITICAL: All generated image prompts MUST adhere to the following visual style: "${visualStyle}". Append these style keywords to every image_prompt you generate. Every single image_prompt must include this visual aesthetic.`;
    }

    // Call Gemini with structured output
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Analyze this screenplay scene:\n\n${sceneContent}`
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawAnalysisText = aiData.choices?.[0]?.message?.content || '{}';
    
    // Log raw response for debugging
    console.log('Raw Gemini response:', rawAnalysisText);
    
    // Sanitize: Strip markdown code blocks and clean control characters
    let analysisText = rawAnalysisText.trim();
    
    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    if (analysisText.startsWith('```')) {
      analysisText = analysisText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '');
    }
    
    console.log('Sanitized text for parsing:', analysisText);
    
    // Parse the JSON response
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
          stakes: 'Unable to parse analysis',
          ownership: 'N/A',
          breaking_point: 'N/A',
          key_props: 'N/A'
        },
        producing_logistics: {
          red_flags: ['Analysis parsing failed'],
          resource_impact: 'Low',
          departments_affected: []
        },
        directing_vision: {
          visual_metaphor: 'Unable to parse',
          editorial_intent: 'Unable to parse',
          shot_motivation: 'Unable to parse'
        },
        shot_list: []
      };
    }

    console.log(`Successfully analyzed scene ${sceneNumber}`);

    return new Response(
      JSON.stringify({ 
        analysis: JSON.stringify(analysisJson),
        status: 'COMPLETED'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Error in analyze-scene:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        status: 'ERROR',
        analysis: JSON.stringify({
          story_analysis: {
            stakes: 'Analysis failed: ' + error.message,
            ownership: 'N/A',
            breaking_point: 'N/A',
            key_props: 'N/A'
          },
          producing_logistics: {
            red_flags: ['Analysis error: ' + error.message],
            resource_impact: 'Low',
            departments_affected: []
          },
          directing_vision: {
            visual_metaphor: 'N/A',
            editorial_intent: 'N/A',
            shot_motivation: 'N/A'
          },
          shot_list: []
        })
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
