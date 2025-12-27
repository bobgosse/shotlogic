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
    const characters = [...new Set(dialogueMatches.map(m => m.trim().replace(/\s*\(CONT'D\)/, '')))]
    const dialogueExchanges = dialogueMatches.length
    const hasAction = /\b(runs?|fights?|chases?|crashes?|explodes?|falls?|grabs?|throws?|hits?|punches?|shoots?|drives?|jumps?|climbs?|escapes?|reveals?|pulls?|pushes?)\b/i.test(sceneText)
    const sceneLength = sceneText.length
    
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

    const systemPrompt = `You are a veteran 1st AD and script supervisor. You plan coverage like David Fincher - OBSESSIVELY detailed.

EXAMPLES OF BAD COVERAGE (DO NOT DO THIS):
❌ "Captures the dynamic between characters" - TOO VAGUE
❌ "Highlights her significance" - MEANINGLESS  
❌ "Sets the mood" - LAZY
❌ "His reaction" - WHICH reaction? To WHAT line?

EXAMPLES OF GOOD COVERAGE (DO THIS):
✅ "CU VIRGINIA - covers her line: 'The water does not ask who you are. It only asks if you can breathe.' - the moment she reveals she knows his poetry"
✅ "POV LEO looking down - his bare feet on wood next to his ink-repaired shoes vs their expensive leather - visual class contrast"
✅ "INSERT - Virginia pulls blanket off her lap, REVEAL her withered legs - the moment Leo sees her vulnerability"
✅ "CU HUBER - reaction to Leo's counter-offer 'Seven' - he's surprised but impressed"
✅ "MEDIUM ROSALIND - unlocking wheelchair brake, her silent efficiency - she's more than just staff"

RULES:
1. If a character speaks, they need a CLOSE-UP for their important lines
2. If a character is in the scene, they need at least ONE featured shot
3. Physical reveals (body parts, objects) need dedicated INSERT or REVEAL shots
4. POV shots must specify: whose eyes, what they see, WHY it matters
5. Coverage field must QUOTE dialogue or describe SPECIFIC action - never vague phrases`

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

EXAMPLE OF A GOOD SHOT ENTRY:
{
  "shot_number": 5,
  "shot_type": "CLOSE_UP",
  "movement": "STATIC",
  "subject": "VIRGINIA - CU on her face as she recites poetry",
  "action": "She quotes Leo's poem, watching for his reaction",
  "coverage": "VIRGINIA: 'The water does not ask who you are. It only asks if you can breathe.' - from her first line through Leo's stunned silence",
  "duration": "Extended hold - let the words land",
  "visual": "Tight on her face, shallow focus, sunken eyes sharp against soft gray sky background",
  "rationale": "TURN of the scene - Virginia reveals she knows Leo's poetry, shifting power from Huber's money to her intellectual connection with Leo. This is the moment Leo decides to take the job."
}

EXAMPLE OF BAD SHOTS (DO NOT DO THIS):
❌ "Gray sky and water, reflective mood" - WHO IS IN THE SHOT?
❌ "Two figures on dock" - WHICH TWO? NAME THEM!
❌ "Medium shot of departure" - WHO IS DEPARTING?
❌ "Focus on legs" - WHOSE LEGS?
❌ "Shows the emotional moment" - WHICH EMOTION? WHY?

SUBJECT FIELD RULES - MANDATORY:
- EVERY shot must name specific characters: "LEO - emerging from water"
- Two-shots must name BOTH: "LEO and HUBER - handshake moment"
- Group shots must list ALL: "HUBER, VIRGINIA, ROSALIND - watching Leo dress"
- POV must specify whose eyes AND what they see: "POV LEO - looking down at his bare feet next to his ink-repaired shoes"
- INSERT must specify the object AND context: "INSERT - HUBER's money clip, two bills being peeled off"
- REVEAL must name what's revealed: "REVEAL - VIRGINIA's withered legs as blanket falls away"

COVERAGE FIELD RULES - MANDATORY:
- Must quote EXACT dialogue: "LEO: 'Seven.' - his counter-offer"
- OR describe SPECIFIC action with character names: "LEO looks down at his feet, then at their expensive shoes - the class divide visualized"
- Must specify START and END of coverage: "From HUBER's 'Five dollars a session' through LEO's 'Seven'"
- NEVER vague phrases like "the negotiation" or "emotional moment"

RATIONALE FIELD RULES - MANDATORY:
- Must connect to scene's CONFLICT TYPE (this is a ${characters.length > 0 ? 'NEGOTIATION' : 'scene'})
- Must reference CHARACTER MOTIVATION: "Leo needs money but resists being bought"
- Must explain WHAT AUDIENCE LEARNS: "We see Leo's pride despite his poverty"
- NEVER generic film-school language like "captures the dynamic" or "sets the mood"

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
      "shot_type": "WIDE/MEDIUM/MEDIUM_CLOSE/CLOSE_UP/EXTREME_CLOSE/INSERT/POV/OVER_SHOULDER/TWO_SHOT/GROUP/REVEAL",
      "movement": "STATIC/PAN/TILT/PUSH_IN/PULL_BACK/DOLLY/TRACK/HANDHELD/STEADICAM/CRANE",
      "subject": "MANDATORY: CHARACTER NAME(S) IN CAPS + what they're doing. Examples: 'LEO - emerging from cold water', 'LEO and HUBER - tense handshake', 'POV LEO - his bare feet next to worn shoes', 'REVEAL - VIRGINIA's withered legs'",
      "action": "SPECIFIC action during this shot",
      "coverage": "MANDATORY: Quote dialogue 'CHARACTER: exact line' OR describe specific beat with names. Specify what lines/action this shot covers from START to END.",
      "duration": "How long to hold: Brief (1-2 sec) / Standard (3-5 sec) / Extended (6+ sec, let it breathe)",
      "visual": "Composition, framing, depth, lighting specifics",
      "rationale": "MANDATORY: Connect to conflict type, character motivation, and what audience learns. NO generic phrases.",
      "image_prompt": "Cinematic still: [character name], [specific action], [visual details], [lighting], [mood]${visualStyle ? `, ${visualStyle}` : ''}, 35mm film, photorealistic"
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

VALIDATION CHECKLIST - YOUR SHOT LIST WILL BE REJECTED IF:
${characters.map(c => `- [ ] ${c} is not named in at least 2 shots`).join('\n')}
- [ ] ANY shot has vague subject like "two figures" instead of naming them
- [ ] ANY shot has generic rationale like "captures the emotion" or "sets the mood"
- [ ] ANY dialogue shot doesn't quote the specific line in coverage
- [ ] POV shots don't specify WHOSE POV and WHAT THEY SEE
- [ ] INSERT/REVEAL shots don't name the specific object/body part AND whose it is

COMMON MISTAKES TO AVOID:
1. "Two figures on dock" ❌ → "HUBER and ROSALIND - watching Leo dress" ✅
2. "Focus on legs" ❌ → "REVEAL - VIRGINIA's withered legs as Scottish wool blanket falls" ✅
3. "Medium shot of departure" ❌ → "ROSALIND - pushing VIRGINIA's wheelchair, both looking back at Leo" ✅
4. "Captures the negotiation" ❌ → "Leo's pride wars with his poverty - he needs this job but won't beg" ✅
5. "Emotional moment" ❌ → "Virginia's poetry quote reveals she's researched Leo - this changes from a business transaction to a personal connection" ✅

Return ONLY valid JSON. No markdown, no explanation.`

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
        temperature: 0.7,
        max_tokens: 10000,  // Increased for detailed coverage with more shots
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
