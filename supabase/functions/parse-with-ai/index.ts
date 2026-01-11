import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════════════════════════
// REGEX-BASED FALLBACK PARSER
// Used when AI parsing fails or is unavailable
// ═══════════════════════════════════════════════════════════════

interface Scene {
  scene_number: number;
  header: string;
  content: string;
}

function isSlugline(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 200) return false;

  // Exclude transitions
  if (/^(FADE|CUT|TITLE|THE END|CONTINUED|DISSOLVE|WIPE|SMASH)/i.test(trimmed)) return false;

  // Check for INT/EXT patterns (enhanced - supports multiple formats)
  const intExtPatterns = [
    /^(?:\d+\s+)?(INT\.?\s*\/?\s*EXT\.?|EXT\.?\s*\/?\s*INT\.?|INT\.?|EXT\.?|INTERIOR|EXTERIOR)/i,
    /^(?:\d+\s+)?(INT|EXT|I\/E)\s*:/i,  // Colon separator
    /^(?:\d+\s+)?(INT|EXT|I\/E)\s*,/i,   // Comma separator
    /[-–—]\s*(INT\.?|EXT\.?|INTERIOR|EXTERIOR|I\/E)\s*(?:[-–—]|$)/i, // Location-first format
  ];

  const hasIntExt = intExtPatterns.some(pattern => pattern.test(trimmed));
  if (!hasIntExt) return false;

  // Must have something after INT/EXT (not just "INT" or "EXT" alone)
  const hasLocation = /^(?:\d+\s+)?(?:INT|EXT|INTERIOR|EXTERIOR|I\/E)[\s\.\-:,\/]+\w/i.test(trimmed);
  if (!hasLocation) {
    // Allow if it's location-first format
    const isLocationFirst = /[-–—]\s*(?:INT|EXT|INTERIOR|EXTERIOR|I\/E)\s*(?:[-–—]|$)/i.test(trimmed);
    if (!isLocationFirst) {
      return false;
    }
  }

  return true;
}

function cleanHeader(header: string): string {
  // Remove scene numbers from header
  let cleaned = header.trim().replace(/^\d+\s+/, '');

  // Normalize spacing
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Ensure proper INT/EXT format
  cleaned = cleaned.replace(/^(INT|EXT|INTERIOR|EXTERIOR|I\/E)\s*[:\.,]?\s*/i, (match, intExt) => {
    const normalized = intExt.toUpperCase();
    if (normalized === 'INTERIOR') return 'INT. ';
    if (normalized === 'EXTERIOR') return 'EXT. ';
    if (normalized === 'I/E') return 'INT./EXT. ';
    return normalized + '. ';
  });

  return cleaned;
}

function regexBasedParse(rawText: string): { scenes: Scene[] } {
  console.log('[FALLBACK] Using regex-based scene detection');

  const lines = rawText.split('\n').map(line => line.trimEnd());
  const scenes: Scene[] = [];

  let currentScene: Scene | null = null;
  let sceneCounter = 0;
  let contentBuffer: string[] = [];
  let i = 0;

  // Skip title page
  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.toUpperCase().includes('SCRIPT TITLE') ||
        line.toUpperCase().includes('WRITTEN BY') ||
        line.toUpperCase().includes('BY:') ||
        (!isSlugline(line) && i < 20)) {
      i++;
      continue;
    }

    if (isSlugline(line)) {
      break;
    }

    i++;
  }

  // Parse scenes
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentScene) contentBuffer.push(line);
      i++;
      continue;
    }

    if (isSlugline(line)) {
      // Save previous scene
      if (currentScene) {
        const trimmedContent = contentBuffer.join('\n').trim();

        if (trimmedContent.length >= 10) {
          currentScene.content = trimmedContent;
          scenes.push(currentScene);
        } else {
          console.warn(`[FALLBACK] Scene ${currentScene.scene_number} has insufficient content - skipping`);
        }

        contentBuffer = [];
      }

      // Create new scene
      sceneCounter++;
      currentScene = {
        scene_number: sceneCounter,
        header: cleanHeader(line),
        content: '',
      };
      i++;
      continue;
    }

    // Add to current scene content
    if (currentScene) {
      contentBuffer.push(line);
    }

    i++;
  }

  // Save final scene
  if (currentScene) {
    const trimmedContent = contentBuffer.join('\n').trim();

    if (trimmedContent.length >= 10) {
      currentScene.content = trimmedContent;
      scenes.push(currentScene);
    } else {
      console.warn(`[FALLBACK] Final scene ${currentScene.scene_number} has insufficient content - skipping`);
    }
  }

  console.log(`[FALLBACK] Detected ${scenes.length} scenes using regex parser`);

  return { scenes };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawText, useFallback } = await req.json();

    if (!rawText) {
      return new Response(
        JSON.stringify({ error: 'No text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsing screenplay text, length:', rawText.length);

    // Check if user explicitly requested fallback or if AI is unavailable
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (useFallback || !OPENAI_API_KEY) {
      if (!OPENAI_API_KEY) {
        console.warn('OPENAI_API_KEY not configured - using regex fallback');
      } else {
        console.log('Fallback explicitly requested');
      }

      const result = regexBasedParse(rawText);

      if (result.scenes.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'PARSE_ERROR: No valid scenes detected. Ensure screenplay uses proper scene headers (INT./EXT. LOCATION - TIME)',
            fallbackUsed: true
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          ...result,
          meta: {
            method: 'regex-fallback',
            totalScenes: result.scenes.length
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try AI parsing first
    console.log('Attempting AI-based parsing with GPT-4o');

    let aiResult;
    let aiError;

    try {
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
          response_format: { type: 'json_object' },
          timeout: 30000 // 30 second timeout
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI error:', response.status, errorText);
        aiError = new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      } else {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          aiError = new Error('No content in AI response');
        } else {
          aiResult = JSON.parse(content);

          // Validate AI result
          if (!aiResult.scenes || !Array.isArray(aiResult.scenes) || aiResult.scenes.length === 0) {
            console.warn('AI returned empty or invalid scenes array - falling back to regex');
            aiError = new Error('AI returned no scenes');
          } else {
            console.log('AI parsed scenes successfully:', aiResult.scenes.length);
          }
        }
      }
    } catch (error) {
      console.error('AI parsing failed:', error);
      aiError = error;
    }

    // If AI succeeded, return AI result
    if (aiResult && !aiError) {
      return new Response(
        JSON.stringify({
          ...aiResult,
          meta: {
            method: 'ai-gpt4o',
            totalScenes: aiResult.scenes.length
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // AI failed - use regex fallback
    console.log(`AI parsing failed (${aiError?.message || 'unknown error'}), falling back to regex parser`);

    const fallbackResult = regexBasedParse(rawText);

    if (fallbackResult.scenes.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'PARSE_ERROR: No valid scenes detected by either AI or regex parser. Ensure screenplay uses proper scene headers (INT./EXT. LOCATION - TIME)',
          aiError: aiError?.message,
          fallbackUsed: true
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        ...fallbackResult,
        meta: {
          method: 'regex-fallback',
          totalScenes: fallbackResult.scenes.length,
          aiError: aiError?.message,
          fallbackReason: 'AI parsing failed'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Critical error in parse-with-ai:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackUsed: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});