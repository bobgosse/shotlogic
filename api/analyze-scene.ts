// api/analyze-scene.ts
// PRODUCTION: Scene analysis with SYSTEMATIC COVERAGE PLANNING

import type { VercelRequest, VercelResponse } from '@vercel/node'

const DEPLOY_TIMESTAMP = "2024-12-27T01:00:00Z_SYSTEMATIC_COVERAGE"

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
  
  console.log(`\n🎬 [${invocationId}] ═══ SCENE ANALYSIS ═══`)
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
    const openaiKey = getEnvironmentVariable('OPENAI_API_KEY')
    
    if (!openaiKey) {
      console.error(`❌ [${invocationId}] OPENAI_API_KEY not found`)
      return res.status(500).json({ 
        error: 'Server Configuration Error',
        message: 'OpenAI API Key is not configured',
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

    // Extract character names from dialogue headers
    const dialogueMatches = sceneText.match(/^[A-Z][A-Z\s]+(?=\n)/gm) || []
    const speakingCharacters = [...new Set(dialogueMatches.map(m => m.trim().replace(/\s*\(CONT'D\)/, '')))]
    
    // Also look for character names mentioned in action lines (capitalized names)
    const actionNameMatches = sceneText.match(/\b([A-Z][a-z]+)\b/g) || []
    const potentialNames = actionNameMatches.filter(name => 
      name.length > 2 && 
      !['The', 'His', 'Her', 'She', 'He', 'They', 'Day', 'Night', 'Int', 'Ext', 'Cold', 'Gray', 'Arms', 'Head', 'Wet', 'Behind', 'Hair', 'Eyes', 'Skin', 'Wind', 'Scottish'].includes(name)
    )
    const actionCharacters = [...new Set(potentialNames)]
    
    // Combine speaking and action characters
    const allCharacters = [...new Set([...speakingCharacters, ...actionCharacters])]
    const characters = allCharacters.filter(c => c.length > 1)
    
    const dialogueExchanges = dialogueMatches.length
    const hasAction = /\b(runs?|fights?|chases?|crashes?|explodes?|falls?|grabs?|throws?|hits?|punches?|shoots?|drives?|jumps?|climbs?|escapes?|reveals?|pulls?|pushes?)\b/i.test(sceneText)
    const sceneLength = sceneText.length
    
    console.log(`📊 Characters detected: ${characters.join(', ')}`)
    
    // Calculate shot requirements - be more aggressive
    const characterCount = characters.length
    let minShots = Math.max(12, characterCount * 4) // At least 4 shots per character
    let maxShots = Math.max(18, characterCount * 5)
    
    if (dialogueExchanges > 8) {
      minShots = Math.max(minShots, Math.ceil(dialogueExchanges * 1.2))
      maxShots = Math.max(maxShots, dialogueExchanges * 2)
    }
    if (hasAction || sceneLength > 1500) {
      minShots += 5
      maxShots += 8
    }
    
    // More generous limits for complex scenes
    minShots = Math.min(minShots, 20)
    maxShots = Math.min(maxShots, 35)

    const systemPrompt = `You are a script supervisor creating a shot list. You MUST follow these ABSOLUTE RULES:

RULE 1 - SUBJECT FIELD: Every shot MUST start with a CHARACTER NAME IN CAPS.
- ✅ "LEO - drying off on dock"
- ✅ "HUBER and ROSALIND - watching from wheelchait"
- ✅ "POV LEO - looking at his bare feet"
- ❌ "Gray sky and water" (NO! Who is in the shot?)
- ❌ "Two figures on dock" (NO! Name them: HUBER and ROSALIND)
- ❌ "Focus on legs" (NO! Say: VIRGINIA's withered legs)

RULE 2 - COVERAGE FIELD: Must quote exact dialogue or describe specific action.
- ✅ "LEO: 'Seven.' - his counter-offer"
- ✅ "VIRGINIA: 'The water does not ask who you are.'"
- ❌ "The negotiation" (NO! Quote the actual lines)
- ❌ "Emotional moment" (NO! What emotion? Whose?)

RULE 3 - RATIONALE FIELD: Explain WHY this shot matters to the story.
- ✅ "Leo's pride battles poverty - he needs money but won't beg"
- ❌ "Captures the dynamic" (NO! What dynamic specifically?)
- ❌ "Sets the mood" (NO! What mood? Why?)

If you write "two figures" instead of naming them, you have FAILED.
If you write "captures the emotion" without specifics, you have FAILED.`

    const userPrompt = `Analyze Scene ${sceneNumber} of ${totalScenes} for full production breakdown.

SCENE TEXT:
"""
${sceneText}
"""

${visualStyle ? `VISUAL STYLE: "${visualStyle}" - incorporate into all image prompts.` : ''}

DETECTED CHARACTERS: ${characters.join(', ')}
DIALOGUE EXCHANGES: ${dialogueExchanges}
SCENE LENGTH: ${sceneLength} chars

=== PHASE 1: COVERAGE PLANNING ===

Before generating shots, ANALYZE the scene for:

A) CHARACTER MOMENTS - For each character, what are their:
   - Key dialogue lines (quote them!)
   - Reaction moments (to what specifically?)
   - Physical actions

B) VISUAL REVEALS - Look for:
   - Body parts revealed (legs, scars, tattoos)
   - Objects revealed (money, weapons, documents)
   - Character entrances/exits
   
C) POV OPPORTUNITIES - Look for:
   - "He looks at..." or "She sees..." moments
   - Character examining objects
   - Character observing other characters

D) POWER DYNAMICS - Track:
   - Who has control at start vs end
   - Moment the power shifts
   - Physical positions (standing/sitting/moving)

For EACH character (${characters.join(', ')}), identify:
- Their entrance/first appearance
- Their most important line(s) - quote them
- Their key reaction moments
- Any physical action or reveal involving them

Also identify:
- POV SHOTS: Whose perspective do we see through? What do they look at?
- REVEALS: Any physical reveals (body parts, objects, documents)?
- INSERTS: Close-ups of hands, objects, or details that matter?

=== PHASE 2: SHOT LIST ===

Generate ${minShots}-${maxShots} shots that provide COMPLETE coverage.

EXAMPLE OF A GOOD SHOT:
{
  "shot_type": "CLOSE_UP",
  "subject": "VIRGINIA - reciting Leo's poetry",
  "coverage": "VIRGINIA: 'The water does not ask who you are. It only asks if you can breathe.'",
  "rationale": "Virginia reveals she knows Leo's poetry - this shifts power from Huber's money to her intellectual connection with Leo"
}

EXAMPLE OF A BAD SHOT - DO NOT DO THIS:
{
  "subject": "Two figures in formal attire",  ← WRONG! Say "HUBER and ROSALIND"
  "coverage": "The negotiation scene",  ← WRONG! Quote the actual dialogue
  "rationale": "Captures the dynamic"  ← WRONG! Explain WHAT dynamic and WHY it matters
}

REQUIREMENTS:
- Every character in ${characters.join(', ')} must have at least ONE dedicated close-up
- Every important line must specify which shot covers it
- POV shots must specify whose POV and what they're looking at
- Coverage field must quote SPECIFIC dialogue or describe SPECIFIC action

Return this EXACT JSON structure:

{
  "story_analysis": {
    "synopsis": "2-3 sentences: WHO does WHAT to WHOM and what CHANGES",
    "stakes": "What's SPECIFICALLY at risk in this scene?",
    "ownership": "Who DRIVES this scene? What's their strategy?",
    "breaking_point": "Quote the EXACT line that shifts the power dynamic",
    "key_props": "Props that characters INTERACT with",
    "tone": "Specific emotional quality (e.g., 'Tense negotiation with undercurrent of attraction')"
  },
  
  "producing_logistics": {
    "resource_impact": "Low or Medium or High",
    "red_flags": ["Specific budget/logistics concerns"],
    "departments_affected": ["Departments with specific requirements"],
    "locations": {
      "primary": "Location description",
      "setting": "Location type",
      "timeOfDay": "DAY/NIGHT/DAWN/DUSK",
      "intExt": "INT/EXT"
    },
    "cast": {
      "principal": ["Main characters"],
      "speaking": ["Characters with dialogue"],
      "silent": ["Characters with action, no dialogue"],
      "extras": { "count": "Number", "description": "What they do" }
    },
    "key_props": ["Props characters interact with"],
    "vehicles": ["If any"],
    "sfx": {
      "practical": ["Practical effects"],
      "vfx": ["VFX needs"],
      "stunts": ["Stunt work"]
    },
    "wardrobe": {
      "principal": ["Costume notes"],
      "notes": "Special requirements"
    },
    "makeup": {
      "standard": ["Basic notes"],
      "special": ["SFX makeup"]
    },
    "scheduling": {
      "constraints": "Timing issues",
      "notes": "Recommendations"
    }
  },
  
  "directing_vision": {
    "visual_metaphor": "How camera work reflects the scene's meaning",
    "editorial_intent": "Pacing strategy - where to cut fast, where to hold",
    "shot_motivation": "Why ${minShots}-${maxShots} shots? How does coverage serve the story?",
    "subtext": "What's REALLY being communicated beneath the dialogue?",
    "conflict": {
      "type": "NEGOTIATION, SEDUCTION, INTERROGATION, CONFESSION, CONFRONTATION, MANIPULATION, PERSUASION, REVELATION, DECEPTION, RECONCILIATION, ULTIMATUM, or POWER_PLAY",
      "description": "WHO wants WHAT from WHOM using what TACTIC?",
      "winner": "Who has the upper hand at scene's end?"
    },
    "tone_and_mood": {
      "opening": "Emotional state at scene start",
      "shift": "Quote the line where tone changes",
      "closing": "Emotional state at scene end",
      "energy": "LOW/BUILDING/HIGH/DECLINING/VOLATILE"
    },
    "visual_strategy": {
      "approach": "OBSERVATIONAL/INTIMATE/FORMAL/KINETIC/SUBJECTIVE",
      "camera_personality": "Neutral observer, character-aligned, or omniscient?",
      "lighting_mood": "Lighting approach"
    },
    "character_motivations": [
      {
        "character": "Name",
        "wants": "Goal in THIS scene",
        "obstacle": "What blocks them",
        "tactic": "How they try to get it"
      }
    ],
    "key_moments": [
      {
        "beat": "Quote specific line or describe action",
        "emphasis": "How to shoot it",
        "why": "Why this moment matters"
      }
    ],
    "performance_notes": ["Direction for each actor"],
    "blocking": {
      "geography": "How characters use power in the space",
      "movement": "Key crosses/gestures",
      "eyelines": "Important looks"
    }
  },
  
  "coverage_plan": {
    "characters": [
      {
        "name": "Character name",
        "entrance": "How/when they first appear",
        "key_lines": ["Quote their most important lines"],
        "reaction_beats": ["Moments where we need their reaction"],
        "required_shots": ["CU needed for X", "Two-shot with Y"]
      }
    ],
    "pov_shots": [
      {
        "whose_pov": "Character name",
        "looking_at": "What they see",
        "why": "Why this POV matters"
      }
    ],
    "reveals": [
      {
        "what": "What's revealed",
        "how": "Camera approach",
        "why": "Story significance"
      }
    ],
    "inserts": [
      {
        "subject": "What we see in close-up",
        "why": "Why it matters"
      }
    ]
  },
  
  "shot_list": [
    {
      "shot_number": 1,
      "shot_type": "WIDE or MEDIUM or CLOSE_UP or INSERT or POV or REVEAL or TWO_SHOT or GROUP",
      "movement": "STATIC or PUSH_IN or DOLLY or HANDHELD etc",
      "subject": "WRITE EXACTLY LIKE THIS: 'LEO - drying off on dock' or 'HUBER and ROSALIND - watching Leo' or 'POV LEO - his bare feet vs worn shoes' or 'REVEAL - VIRGINIA's withered legs'. NEVER write 'two figures' or 'gray sky' without naming the character.",
      "action": "What the character DOES during this shot",
      "coverage": "WRITE EXACTLY LIKE THIS: 'LEO: Seven. - his counter-offer turns the negotiation' or 'From HUBER: Five dollars a session through LEO taking the money'. ALWAYS quote dialogue or specify exact action.",
      "duration": "Brief (1-2s) or Standard (3-5s) or Extended (6+s)",
      "visual": "Composition and lighting details",
      "rationale": "WRITE EXACTLY LIKE THIS: 'Leo's pride battles his poverty - he needs this money but won't appear desperate. Audience sees his internal conflict.' NEVER write 'captures the mood' or 'shows the emotion'.",
      "image_prompt": "Start with character name: 'Leo Libretti, wet from swimming, towel to face, cold gray dock...'"
    }
  ],
  
  "shot_list_justification": "Explain your coverage strategy. How did you ensure every character (${characters.join(', ')}) gets their moments? Which editorial pairs did you plan? What POVs and inserts support the story?"
}

CRITICAL RULES:
1. EVERY character in [${characters.join(', ')}] MUST have at least ONE dedicated close-up shot - if you skip a character, you have FAILED
2. The "coverage" field must quote SPECIFIC DIALOGUE or describe SPECIFIC ACTION - never vague phrases like "his reaction" or "captures the dynamic"
3. Include at least ONE POV shot if any character LOOKS at something important
4. Include INSERT shots for important objects (money, hands, feet, documents, props mentioned in script)
5. If there's a PHYSICAL REVEAL (body part, hidden object, etc.) it needs a dedicated shot
6. Generate ${minShots}-${maxShots} shots - every shot must have a SPECIFIC purpose
7. For every important LINE, there should be a shot that covers the speaker AND a shot for the listener's reaction

VALIDATION - YOUR RESPONSE WILL BE REJECTED IF:
- Any "subject" field doesn't start with a CHARACTER NAME IN CAPS
- Any "subject" says "two figures" or "gray sky" without naming who
- Any "coverage" field doesn't quote specific dialogue or action
- Any "rationale" says "captures" or "sets the mood" or "dynamic"

EVERY CHARACTER IN THIS SCENE NEEDS COVERAGE:
${characters.join(', ')} - each must appear by name in at least 2 shots

Return ONLY valid JSON. No markdown.`

    console.log(`🤖 [${invocationId}] Calling OpenAI API...`)
    console.log(`📊 [${invocationId}] Characters: ${characters.join(', ')}`)
    console.log(`📊 [${invocationId}] Requesting ${minShots}-${maxShots} shots`)
    const openaiStartTime = Date.now()
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,  // Lower for more consistent rule-following
        max_tokens: 10000,
        response_format: { type: 'json_object' }
      }),
    })

    const openaiDuration = Date.now() - openaiStartTime
    console.log(`⏱️  [${invocationId}] OpenAI responded in ${openaiDuration}ms`)

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error(`❌ [${invocationId}] OpenAI error: ${errorText}`)
      return res.status(500).json({
        error: 'OpenAI API Error',
        details: errorText,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const openaiData = await openaiResponse.json()
    const content = openaiData.choices?.[0]?.message?.content

    if (!content) {
      return res.status(500).json({
        error: 'Empty response from OpenAI',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    let analysis
    try {
      analysis = JSON.parse(content)
    } catch (parseError) {
      console.error(`❌ [${invocationId}] JSON parse error:`, parseError)
      return res.status(500).json({
        error: 'Failed to parse analysis',
        raw: content.substring(0, 500),
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Validate shot list has required coverage
    const shotList = analysis.shot_list || []
    const charactersWithCU = new Set<string>()
    shotList.forEach((shot: any) => {
      if (shot.shot_type === 'CLOSE_UP' || shot.shot_type === 'MEDIUM_CLOSE') {
        characters.forEach(char => {
          if (shot.subject?.toLowerCase().includes(char.toLowerCase())) {
            charactersWithCU.add(char)
          }
        })
      }
    })

    console.log(`✅ [${invocationId}] Analysis complete`)
    console.log(`   - Characters: ${characters.join(', ')}`)
    console.log(`   - Characters with CU: ${[...charactersWithCU].join(', ') || 'None detected'}`)
    console.log(`   - Shots: ${shotList.length}`)
    console.log(`   - Conflict type: ${analysis.directing_vision?.conflict?.type || 'N/A'}`)
    console.log(`   - POV shots planned: ${analysis.coverage_plan?.pov_shots?.length || 0}`)
    console.log(`   - Inserts planned: ${analysis.coverage_plan?.inserts?.length || 0}`)

    return res.status(200).json({
      success: true,
      analysis: analysis,
      meta: {
        sceneNumber,
        processingTime: openaiDuration,
        characters,
        dialogueExchanges,
        requestedShots: `${minShots}-${maxShots}`,
        actualShots: shotList.length,
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
