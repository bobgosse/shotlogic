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
    const { rawText } = await req.json();
    
    if (!rawText) {
      return new Response(
        JSON.stringify({ error: 'No text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsing screenplay text with AI, length:', rawText.length);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

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
            content: `You are a Screenplay Formatter. Your job is to extract the scenes from the raw script text. The goal is general compatibility with standard screenplay formatting.

CRITICAL NUMBERING CONSTRAINT: The 'scene_number' in the JSON output MUST be sequentially re-numbered starting from 1 (1, 2, 3, 4, ...). Ignore any scene numbers found in the raw text.

CRITICAL SEGMENTATION RULE: A new scene begins ONLY when a valid slugline (INT./EXT. location - TIME) is encountered.
    1. STRICTNESS: Only create a new scene record when the LOCATION or TIME (DAY/NIGHT) changes.
    2. CONSOLIDATION: Any text following a valid slugline, including headers that do not start with INT./EXT., must be consolidated into the preceding scene unit until a fundamentally different slugline is found.

Return a JSON object with a "scenes" array where each item has:
- scene_number (integer): The sequentially re-numbered scene number (1, 2, 3, etc.)
- header (string): Cleaned scene header (e.g., "INT. CLASSROOM - DAY")
- content (string): The dialogue and action for that scene

Fix spacing issues, reconstruct proper headers, and ignore title pages.`
          },
          {
            role: 'user',
            content: rawText
          }
        ],
        response_format: { type: 'json_object' }
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in AI response');
    }

    const parsed = JSON.parse(content);
    console.log('AI parsed scenes:', parsed.scenes?.length || 0);

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-with-ai:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});