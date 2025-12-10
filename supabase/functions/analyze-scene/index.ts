// supabase/functions/analyze-scene/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface AnalyzeRequest {
  sceneNumber: number;
  header: string;
  content: string;
  scriptTitle: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { sceneNumber, header, content, scriptTitle }: AnalyzeRequest = await req.json();

    // Validation
    if (!header || !content) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: header and content' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // Call OpenAI for analysis ONLY (not parsing)
    const analysis = await analyzeSceneWithAI(header, content, scriptTitle);

    return new Response(
      JSON.stringify({
        sceneNumber,
        header,
        ...analysis,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Analysis error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Analyze a single scene with OpenAI
 * This function receives pre-parsed, clean scene content
 */
async function analyzeSceneWithAI(header: string, content: string, scriptTitle: string) {
  const prompt = `You are analyzing a single scene from the screenplay "${scriptTitle}".

SCENE HEADER: ${header}

SCENE CONTENT:
${content}

Your task is to analyze this scene and provide:

1. **Stakes**: What is at stake in this scene? What could be won or lost? (1-2 sentences)

2. **Shot List**: Break down this scene into individual shots. For each shot, provide:
   - Shot number (sequential within this scene)
   - Shot type (e.g., "Wide Shot", "Close-Up", "Medium Shot", "Over-the-Shoulder")
   - Subject (who/what is being filmed)
   - Description (what happens in this shot)

Respond ONLY with valid JSON in this exact format:
{
  "stakes": "string",
  "shots": [
    {
      "shotNumber": 1,
      "type": "string",
      "subject": "string",
      "description": "string"
    }
  ]
}

Do not include any text before or after the JSON. Do not use markdown code blocks.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional script supervisor and cinematographer. You analyze screenplay scenes and break them into detailed shot lists. You respond only with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content_text = data.choices[0]?.message?.content;

  if (!content_text) {
    throw new Error('No response from OpenAI');
  }

  try {
    return JSON.parse(content_text);
  } catch (e) {
    console.error('Failed to parse OpenAI response:', content_text);
    throw new Error('Invalid JSON response from AI');
  }
}