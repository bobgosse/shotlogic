// api/analyze-scene.ts
// Scene analysis using Claude API (Anthropic)

import type { VercelRequest, VercelResponse } from '@vercel/node'

const DEPLOY_TIMESTAMP = "2025-01-01T15:00:00Z_VISUAL_STYLE_FIX"

function getEnvironmentVariable(name: string): string | undefined {
  try {
    if (process.env && typeof process.env === 'object') {
      const value = process.env[name]
      if (value !== undefined && value !== null) {
        return value
      }
    }
    return undefined
  } catch (error) {
    console.error(`Failed to access environment variable "${name}":`, error)
    return undefined
  }
}

interface AnalyzeSceneRequest {
  sceneText: string
  sceneNumber: number
  totalScenes: number
  visualStyle?: string
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`\n🎬 [${invocationId}] ═══ SCENE ANALYSIS (CLAUDE) ═══`)
  console.log(`📅 Timestamp: ${new Date().toISOString()}`)
  console.log(`🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)
  
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', deployMarker: DEPLOY_TIMESTAMP })
  }

  try {
    const anthropicKey = getEnvironmentVariable('ANTHROPIC_API_KEY')
    
    if (!anthropicKey) {
      console.error(`❌ [${invocationId}] ANTHROPIC_API_KEY not found`)
      return res.status(500).json({ 
        error: 'Server Configuration Error',
        message: 'Anthropic API Key is not configured',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const requestBody = req.body as AnalyzeSceneRequest
    const { sceneText, sceneNumber, totalScenes, visualStyle } = requestBody
    
    console.log(`📊 [${invocationId}] Scene: ${sceneNumber}/${totalScenes}`)
    console.log(`📊 [${invocationId}] Text length: ${sceneText?.length || 0} chars`)
    console.log(`📊 [${invocationId}] Visual style: ${visualStyle ? 'YES' : 'NO'}`)

    if (!sceneText || sceneNumber == null || totalScenes == null) {
      return res.status(400).json({ error: 'Missing required fields', deployMarker: DEPLOY_TIMESTAMP })
    }

    // Extract character names from dialogue headers (most reliable)
    const dialogueMatches = sceneText.match(/^[A-Z][A-Z\s]+(?=\n)/gm) || []
    const speakingCharacters = [...new Set(dialogueMatches.map(m => m.trim().replace(/\s*\(CONT'D\)/, '')))]
    
    // Look for non-speaking characters: "Name stands", "Name watches", etc.
    const actionPattern = /\b([A-Z][a-z]{2,})\s+(?:stands?|watches?|eyes|looks?|pushes?|pulls?|walks?|sits?|moves?|turns?|enters?|exits?|leaves?|waits?|unlocks?)\b/g
    const actionMatches = [...sceneText.matchAll(actionPattern)]
    const actionCharacters = actionMatches.map(m => m[1])
    
    // Also catch "Name, Name stand watching" pattern
    const groupPattern = /\b([A-Z][a-z]{2,}),\s*([A-Z][a-z]{2,})\s+(?:stand|watch|sit|wait)/g
    const groupMatches = [...sceneText.matchAll(groupPattern)]
    for (const m of groupMatches) {
      actionCharacters.push(m[1], m[2])
    }
    
    // Combine and dedupe
    const allCharacters = [...new Set([...speakingCharacters, ...actionCharacters])]
    
    // Filter out words that aren't character names
    const notCharacters = ['Camera', 'Shot', 'Scene', 'Something', 'Behind', 'Wind']
    const characters = allCharacters.filter(c => c.length > 2 && !notCharacters.includes(c))
    
    const dialogueExchanges = dialogueMatches.length
    const sceneLength = sceneText.length

    console.log(`📊 [${invocationId}] Characters: ${characters.join(', ')}`)

    const userPrompt = `You are a professional 1st AD and script supervisor creating a shot list for Scene ${sceneNumber} of ${totalScenes}.

<scene_text>
${sceneText}
</scene_text>

<characters_in_scene>
${characters.join(', ')}
</characters_in_scene>
<instructions>
DETERMINE SHOT COUNT BASED ON SCENE COMPLEXITY:
- A quiet scene with one character doing one thing might need only 3-5 shots
- A dialogue scene between two characters might need 8-15 shots for proper coverage
- A complex scene with multiple characters, action, and dialogue might need 20+ shots
- Base your shot count on: number of significant narrative events, number of characters requiring coverage, amount of dialogue needing shot/reverse-shot coverage

HITCHCOCK'S RULE - SHOT SIZE = STORY IMPORTANCE:
"The size of an object in the frame should be proportional to its importance in the story at that moment."
- If something MATTERS (clue, threat, emotional trigger, key prop), give it a CLOSE-UP or foreground dominance
- If something doesn't matter yet, keep it smaller, backgrounded, or visually de-emphasized
- A key, knife, letter, photograph, glass of milk: BIG and unmistakable when story-critical
- Apply this to characters too: the character with power/focus in the moment gets the tighter shot

ABSOLUTE RULE - CHARACTER NAMES, NEVER PRONOUNS:
- EVERY shot description MUST name the character by NAME in CAPS
- ✓ "CLOSE-UP: LEO - his jaw tightens as he processes the insult"
- ✓ "TWO-SHOT: VIRGINIA and HUBER - exchanging a knowing glance"
- ✗ NEVER write "He turns away" - write "LEO turns away"
- ✗ NEVER write "She reaches for it" - write "VIRGINIA reaches for the letter"
- ✗ NEVER write "They embrace" - write "LEO and MARIA embrace"

SUBJECT FIELD - Must name the character(s) in CAPS:
- ✓ "LEO - emerging from water, toweling off"
- ✓ "HUBER and ROSALIND - watching Leo from the dock"
- ✓ "INSERT: THE LETTER - Virginia's handwriting visible"
- ✗ NEVER write "Two figures" or "Focus on legs" without naming WHO

COVERAGE FIELD - Must quote specific dialogue or describe exact action:
- ✓ "LEO: 'Seven.' - his counter-offer"
- ✓ "Leo looks down at his bare feet, then at their expensive shoes"
- ✗ NEVER write vague descriptions like "The negotiation" or "emotional moment"

RATIONALE FIELD - Explain WHY this shot, using Hitchcock's principle:
- ✓ "Close-up on the knife NOW because Leo has just noticed it - it becomes his way out"
- ✓ "Wide shot here to diminish Virginia's power as Leo walks away"
- ✗ NEVER write "Captures the dynamic" or "Sets the mood"

IMAGE_PROMPT FIELD (CRITICAL - THIS IS WHAT MIDJOURNEY SEES):
- Describe the SPECIFIC ACTION happening in this shot, not positions
- BAD: "VIRGINIA in wheelchair by window, EDMUND at fireplace"
- GOOD: "ROSALIND (stern 40s woman) pins VIRGINIA (frail 16-year-old girl in wheelchair)'s legs under blanket while VIRGINIA stares longingly at book, EDMUND ignores them checking pocket watch"
- Include CHARACTER DESCRIPTORS: "VIRGINIA (frail teenage girl)" not just "VIRGINIA"
- Include: WHO is doing WHAT to WHOM, facial expressions, body language
- Every prompt must answer: "What is the character DOING in this moment?"
- Keep it under 30 words after the shot type
EVERY CHARACTER in the scene must appear BY NAME in at least 2 shots:
EVERY CHARACTER in the scene must appear BY NAME in at least 2 shots:
${characters.map(c => `- ${c}`).join('\n')}
</instructions>

Return ONLY a JSON object with this structure:

{
  "story_analysis": {
    "synopsis": "2-3 sentence summary",
    "stakes": "What's at risk",
    "ownership": "Who drives the scene",
    "breaking_point": "The exact line/moment that shifts power",
    "key_props": "Important props",
    "tone": "Specific emotional quality"
  },
  "producing_logistics": {
    "resource_impact": "Low/Medium/High",
    "red_flags": ["specific concerns"],
    "departments_affected": ["Camera", "Art", etc],
    "locations": {
      "primary": "description",
      "setting": "type",
      "timeOfDay": "DAY/NIGHT",
      "intExt": "INT/EXT"
    },
    "cast": {
      "principal": ["names"],
      "speaking": ["names"],
      "silent": ["names"],
      "extras": {"count": "number", "description": "what they do"}
    },
    "key_props": ["list"],
    "vehicles": ["if any"],
    "sfx": {"practical": [], "vfx": [], "stunts": []},
    "wardrobe": {"principal": [], "notes": ""},
    "makeup": {"standard": [], "special": []},
    "scheduling": {"constraints": "", "notes": ""}
  },
  "directing_vision": {
    "visual_metaphor": "How camera expresses meaning",
    "editorial_intent": "Pacing strategy",
    "shot_motivation": "Why this many shots",
    "subtext": "What's beneath the dialogue",
    "conflict": {
      "type": "NEGOTIATION/SEDUCTION/CONFRONTATION/etc",
      "description": "Who wants what from whom",
      "winner": "Who has upper hand at end"
    },
    "tone_and_mood": {
      "opening": "Starting emotional state",
      "shift": "Where/how it changes",
      "closing": "Ending emotional state",
      "energy": "LOW/BUILDING/HIGH/DECLINING/VOLATILE"
    },
    "visual_strategy": {
      "approach": "OBSERVATIONAL/INTIMATE/FORMAL/KINETIC",
      "camera_personality": "Observer/aligned/omniscient",
      "lighting_mood": "Description"
    },
    "character_motivations": [
      {"character": "NAME", "wants": "goal", "obstacle": "what blocks", "tactic": "how they try"}
    ],
    "key_moments": [
      {"beat": "specific line/action", "emphasis": "how to shoot", "why": "importance"}
    ],
    "performance_notes": ["direction for each actor"],
    "blocking": {
      "geography": "How space is used",
      "movement": "Key movements",
      "eyelines": "Important looks"
    }
  },
  "shot_list": [
    {
      "shot_number": 1,
      "shot_type": "WIDE/MEDIUM/CLOSE_UP/INSERT/POV/REVEAL/TWO_SHOT/GROUP",
      "movement": "STATIC/PUSH_IN/DOLLY/HANDHELD/etc",
      "subject": "CHARACTER_NAME in CAPS - what they are doing (NEVER use he/she/they - ALWAYS the name)",
      "action": "CHARACTER_NAME does specific action (use their NAME, not pronouns)",
      "coverage": "CHARACTER_NAME: 'Dialogue line' OR CHARACTER_NAME performs specific action",
      "duration": "Brief/Standard/Extended",
      "visual": "Composition showing CHARACTER_NAME - describe their position/framing",
      "rationale": "Why CHARACTER_NAME gets this shot size now - apply Hitchcock principle",
      "image_prompt": "shot type, CHARACTER_NAME, specific action, setting, lighting"
    }
  ],
  "shot_list_justification": "List each character and which shot numbers feature them by NAME"
}`

    console.log(`🤖 [${invocationId}] Calling Claude API...`)
    const startTime = Date.now()
    
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      }),
    })

    const duration = Date.now() - startTime
    console.log(`⏱️  [${invocationId}] Claude responded in ${duration}ms`)

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text()
      console.error(`❌ [${invocationId}] Claude API error: ${errorText}`)
      return res.status(500).json({
        error: 'Claude API Error',
        details: errorText,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const anthropicData = await anthropicResponse.json()
    const content = anthropicData.content?.[0]?.text

    if (!content) {
      return res.status(500).json({
        error: 'Empty response from Claude',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Extract JSON from response (Claude might wrap it in markdown)
    let jsonStr = content
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }
    
    // Also try to find raw JSON object
    const rawJsonMatch = content.match(/\{[\s\S]*\}/)
    if (rawJsonMatch && !jsonMatch) {
      jsonStr = rawJsonMatch[0]
    }

    let analysis
    try {
      analysis = JSON.parse(jsonStr.trim())
    } catch (parseError) {
      console.error(`❌ [${invocationId}] JSON parse error:`, parseError)
      console.error(`Raw content: ${content.substring(0, 500)}`)
      return res.status(500).json({
        error: 'Failed to parse analysis',
        raw: content.substring(0, 1000),
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const shotList = analysis.shot_list || []
    
    // ═══════════════════════════════════════════════════════════════
    // PREPEND VISUAL STYLE TO EVERY IMAGE PROMPT (GUARANTEED TO WORK)
    // ═══════════════════════════════════════════════════════════════
    if (visualStyle && shotList.length > 0) {
      console.log(`🎨 [${invocationId}] Prepending visual style to ${shotList.length} image prompts`)
      shotList.forEach((shot: any) => {
        if (shot.image_prompt) {
          shot.image_prompt = visualStyle + ", " + shot.image_prompt
        }
      })
    }
    
    console.log(`✅ [${invocationId}] Analysis complete`)
    console.log(`   - Shots: ${shotList.length}`)
    console.log(`   - Conflict type: ${analysis.directing_vision?.conflict?.type || 'N/A'}`)

    return res.status(200).json({
      success: true,
      analysis: analysis,
      meta: {
        sceneNumber,
        processingTime: duration,
        characters,
        dialogueExchanges,
        requestedShots: "variable",
        actualShots: shotList.length,
        model: 'claude-sonnet-4-20250514',
        deployMarker: DEPLOY_TIMESTAMP
      }
    })

  } catch (error) {
    console.error(`❌ [${invocationId}] Error:`, error)
    return res.status(500).json({
      error: 'Analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      deployMarker: DEPLOY_TIMESTAMP
    })
  }
}
