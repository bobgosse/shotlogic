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

    // CHANGED: Use OpenAI Key directly
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // CHANGED: Call OpenAI directly instead of Lovable gateway
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Using standard OpenAI model
        messages: [
          {
            role: 'system',
            content: `You are a Screenplay Formatter. The input text has broken formatting (extra spaces like "P H O N E", missing newlines, mashed numbers like "DAY 1 1"). Your job is to extract the scenes and clean the formatting.

Return a JSON object with a "scenes" array where each item has:
- scene_number (integer): The scene number from the screenplay
- header (string): Cleaned scene header (e.g., "INT. CLASSROOM - DAY")
- content (string): The dialogue and action for that scene

Fix spacing issues, reconstruct proper headers, and ignore title pages or headers containing "SCRIPT TITLE".`
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
      console.error('OpenAI API error:', response.status, errorText);
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