// api/analyze-scene.ts
// Scene analysis using Claude API (Anthropic)

import type { VercelRequest, VercelResponse } from '@vercel/node'

const DEPLOY_TIMESTAMP = "2024-12-27T17:00:00Z_CLAUDE_API"

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
    
    // Calculate shot count
    const characterCount = characters.length
    let minShots = Math.max(12, characterCount * 3)
    let maxShots = Math.max(18, characterCount * 4)
    
    if (dialogueExchanges > 8) {
      minShots = Math.max(minShots, dialogueExchanges)
      maxShots = Math.max(maxShots, Math.ceil(dialogueExchanges * 1.5))
    }
    
    minShots = Math.min(minShots, 20)
    maxShots = Math.min(maxShots, 30)

    console.log(`📊 [${invocationId}] Requesting ${minShots}-${maxShots} shots`)
    console.log(`📊 [${invocationId}] Requesting ${minShots}-${maxShots} shots`)

    const userPrompt = `You are a professional 1st AD and script supervisor creating a shot list for Scene ${sceneNumber} of ${totalScenes}.

<scene_text>
${sceneText}
</scene_text>

${visualStyle ? `<visual_style>${visualStyle}</visual_style>` : ''}

<characters_in_scene>
${characters.join(', ')}
</characters_in_scene>

<instructions>
Create a detailed shot list with ${minShots}-${maxShots} shots.

CRITICAL RULES YOU MUST FOLLOW:

1. SUBJECT FIELD - Must name the character(s) in CAPS:
   ✓ "LEO - emerging from water, toweling off"
   ✓ "HUBER and ROSALIND - watching Leo from the dock"  
   ✓ "VIRGINIA - in wheelchair, reciting poetry"
   ✓ "POV LEO - looking down at his bare feet next to worn shoes"
   ✓ "REVEAL - VIRGINIA's withered legs as blanket falls"
   ✗ NEVER write "Two figures" - name them!
   ✗ NEVER write "Gray sky and water" without saying who's in shot
   ✗ NEVER write "Focus on legs" - say WHOSE legs!

2. COVERAGE FIELD - Must quote specific dialogue or describe exact action:
   ✓ "LEO: 'Seven.' - his counter-offer"
   ✓ "VIRGINIA: 'The water does not ask who you are. It only asks if you can breathe.'"
   ✓ "Leo looks down at his bare feet, then at their expensive shoes"
   ✗ NEVER write "The negotiation" or "emotional moment"

3. RATIONALE FIELD - Explain story purpose:
   ✓ "Leo's pride battles his poverty - he needs money but won't beg"
   ✓ "Virginia reveals she knows Leo's poetry, shifting power from money to connection"
   ✗ NEVER write "Captures the dynamic" or "Sets the mood"

4. EVERY CHARACTER must appear BY NAME in at least 2 shots:
   ${characters.map(c => `- ${c}`).join('\n   ')}
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
      "subject": "CHARACTER NAME - what they're doing (MUST name the character!)",
      "action": "What happens during shot",
      "coverage": "Quote dialogue: 'CHARACTER: Line' OR describe specific action",
      "duration": "Brief/Standard/Extended",
      "visual": "Composition and lighting",
      "rationale": "WHY this shot - story purpose, not generic terms",
      "image_prompt": "Character name, action, setting, lighting, mood, 35mm film"
    }
  ],
  "shot_list_justification": "How you ensured each character (${characters.join(', ')}) gets coverage"
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
        requestedShots: `${minShots}-${maxShots}`,
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
