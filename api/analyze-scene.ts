// api/analyze-scene.ts
// PRODUCTION: Enhanced screenplay scene analysis with skills-based prompting
// Combines Story Analyst, Line Producer, Director, and Cinematographer expertise

import type { VercelRequest, VercelResponse } from '@vercel/node'

const DEPLOY_TIMESTAMP = "2024-12-22T14:00:00Z_ENHANCED_SKILLS"

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
  
  console.log(`\n🎬 [${invocationId}] ═══ ENHANCED SCENE ANALYSIS ═══`)
  console.log(`📅 Timestamp: ${new Date().toISOString()}`)
  console.log(`🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      deployMarker: DEPLOY_TIMESTAMP 
    })
  }

  try {
    // Get API key
    const openaiKey = getEnvironmentVariable('OPENAI_API_KEY')
    
    if (!openaiKey) {
      console.error(`❌ [${invocationId}] OPENAI_API_KEY not found`)
      return res.status(500).json({ 
        error: 'Server Configuration Error',
        message: 'OpenAI API Key is not configured',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Parse request
    const requestBody = req.body as AnalyzeSceneRequest
    const { sceneText, sceneNumber, totalScenes, visualStyle } = requestBody
    
    console.log(`📊 [${invocationId}] Scene: ${sceneNumber}/${totalScenes}`)
    console.log(`📊 [${invocationId}] Text length: ${sceneText?.length || 0} chars`)
    console.log(`📊 [${invocationId}] Visual style: ${visualStyle || 'None'}`)

    if (!sceneText || sceneNumber == null || totalScenes == null) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // ═══════════════════════════════════════════════════════════════
    // ENHANCED SKILLS-BASED PROMPTS
    // ═══════════════════════════════════════════════════════════════
    
    const systemPrompt = `You are an elite film production team combined into one expert analyst:

**THE STORY ANALYST** (Former development executive, 20 years experience)
- Identifies narrative stakes, character objectives, and dramatic tension
- Recognizes scene types: exposition, confrontation, revelation, transition
- Understands subtext and what's NOT being said
- Tracks character arcs and power dynamics

**THE LINE PRODUCER** (Award-winning producer, budgets from $500K to $50M)
- Instantly spots budget red flags and production challenges
- Identifies all physical requirements: props, wardrobe, vehicles, locations
- Flags stunts, VFX, special equipment, crowd scenes
- Thinks about scheduling and day/night shoots

**THE DIRECTOR** (Sundance winner, known for visual storytelling)
- Designs coverage that serves emotional truth
- Understands shot motivation - why THIS shot at THIS moment
- Creates visual metaphors that enhance theme
- Plans transitions and editorial rhythm

**THE CINEMATOGRAPHER** (Oscar-nominated DP)
- Knows lighting for mood and practical execution
- Understands camera movement motivation
- Creates depth and visual interest in every frame
- Designs shots that cut together seamlessly

Your combined expertise produces analysis that is PRACTICAL, SPECIFIC, and PRODUCTION-READY.`

    // Determine scene complexity for shot count scaling
    const sceneLength = sceneText.length
    const hasAction = /\b(runs?|fights?|chases?|crashes?|explodes?|falls?|grabs?|throws?|hits?|punches?)\b/i.test(sceneText)
    const dialogueMatches = sceneText.match(/[A-Z]{2,}(?:\s*\([^)]*\))?\s*$/gm) || []
    const characterCount = new Set(dialogueMatches.map(m => m.split(/\s/)[0])).size
    
    let shotCountGuidance = "5-7 shots"
    let complexity = "MEDIUM"
    
    if (sceneLength > 2000 || hasAction || characterCount > 4) {
      shotCountGuidance = "8-12 shots"
      complexity = "HIGH"
    } else if (sceneLength > 1000 || characterCount > 2) {
      shotCountGuidance = "6-8 shots"
      complexity = "MEDIUM-HIGH"
    } else if (sceneLength < 300) {
      shotCountGuidance = "3-5 shots"
      complexity = "LOW"
    }
    
    console.log(`📊 [${invocationId}] Complexity: ${complexity}, Shots: ${shotCountGuidance}`)

    const userPrompt = `Analyze Scene ${sceneNumber} of ${totalScenes} with the depth of a professional film production team.

═══════════════════════════════════════════════════════
SCENE TEXT:
═══════════════════════════════════════════════════════
${sceneText}

${visualStyle ? `═══════════════════════════════════════════════════════
VISUAL STYLE MANDATE: "${visualStyle}"
ALL image prompts MUST reflect this aesthetic.
═══════════════════════════════════════════════════════` : ''}

Return a JSON object with this EXACT structure:

{
  "narrativeAnalysis": {
    "synopsis": "3-4 sentence summary capturing the DRAMATIC ACTION, not just plot. What changes? What's at stake?",
    "centralConflict": "Choose: Argument | Seduction | Negotiation | Confrontation | Revelation | Discovery | Escape | Pursuit | Transformation | Moment_of_Decision | Other",
    "sceneTurn": "Quote the SPECIFIC line or describe the exact action where power shifts or new information changes everything",
    "emotionalTone": "Primary mood with any SHIFT noted (e.g., 'Tense anticipation → explosive frustration')",
    "stakes": "Be SPECIFIC: What exactly does the protagonist risk losing? What could they gain?",
    "subtext": "What's really being communicated beneath the surface dialogue/action?"
  },
  
  "producingAnalysis": {
    "keyProps": ["List EVERY prop characters interact with - be exhaustive"],
    "wardrobe": ["Notable costume elements mentioned or implied"],
    "locations": {
      "setting": "Primary location with specific requirements",
      "timeOfDay": "DAY | NIGHT | DAWN | DUSK",
      "intExt": "INT | EXT | INT/EXT"
    },
    "cast": {
      "speaking": ["Characters with dialogue"],
      "silent": ["Characters present but without dialogue"],
      "background": "Description of extras needed, if any"
    },
    "specialRequirements": ["Stunts, VFX, SFX, animals, children, vehicles, weather effects, etc."],
    "budgetFlags": ["Items that will significantly impact budget - be specific about WHY"],
    "departmentAlerts": {
      "camera": "Special equipment needs",
      "grip": "Rigging, cranes, dollies needed",
      "electric": "Special lighting setups",
      "art": "Set dressing requirements",
      "props": "Hero props or multiples needed",
      "wardrobe": "Special costume needs",
      "makeup": "Special makeup/prosthetics",
      "sound": "Production sound challenges"
    }
  },
  
  "directingAnalysis": {
    "sceneObjective": "What MUST the audience understand/feel by the end of this scene?",
    "visualApproach": "Overall visual strategy (e.g., 'Handheld intimacy', 'Static formality', 'Dynamic pursuit')",
    "keyMoments": [
      {
        "beat": "Specific moment or line",
        "emphasis": "How to shoot it for maximum impact"
      }
    ],
    "performanceNotes": "Key emotional beats actors must hit",
    "blockingIdeas": "Suggested character movement and positioning"
  },
  
  "shotList": [
    {
      "shotNumber": 1,
      "shotType": "WIDE | MEDIUM | MEDIUM_CLOSE | CLOSE_UP | EXTREME_CLOSE | INSERT | POV | OVER_SHOULDER | TWO_SHOT | GROUP",
      "movement": "STATIC | PAN | TILT | PUSH_IN | PULL_BACK | DOLLY | TRACK | HANDHELD | STEADICAM | CRANE",
      "subject": "Who/what is the subject",
      "action": "What happens DURING this shot",
      "visualDescription": "What the audience SEES - be cinematic and specific",
      "rationale": "Why THIS shot serves the story",
      "editorialIntent": "When would an editor cut TO this and WHY",
      "duration": "BEAT | SHORT | MEDIUM | LONG",
      "aiImagePrompt": "Format: [Shot size], [Subject doing specific action], [Detailed setting], [Specific lighting], [Mood/atmosphere]${visualStyle ? `, Style: ${visualStyle}` : ''}"
    }
  ]
}

═══════════════════════════════════════════════════════
SHOT LIST REQUIREMENTS (Generate ${shotCountGuidance}):
═══════════════════════════════════════════════════════

COVERAGE RULES:
- NEW LOCATION = Start with WIDE establishing shot
- DIALOGUE = Over-shoulders and clean singles for each speaker
- EMOTION = CLOSE_UP on reactions, not just speakers  
- OBJECTS = INSERT shots for props that matter to plot
- ACTION = Break complex action into clear beats

PACING:
- Vary shot sizes for rhythm (avoid 3+ same sizes in a row)
- Place most impactful shot at scene's turning point
- End on a shot that transitions well to next scene

IMAGE PROMPTS - Be SPECIFIC:
- Setting: Not "a room" but "cramped fluorescent-lit office, beige cubicle walls"
- Lighting: Direction and quality ("harsh overhead fluorescent" vs "warm golden hour through blinds")
- Atmosphere: Smoke, rain, dust, steam if present
- Character state: Specific expression/posture
${visualStyle ? `- EVERY prompt MUST incorporate: "${visualStyle}"` : ''}

Return ONLY valid JSON. No markdown, no explanation outside JSON.`

    // ═══════════════════════════════════════════════════════════════
    // CALL OPENAI API
    // ═══════════════════════════════════════════════════════════════
    
    console.log(`🤖 [${invocationId}] Calling OpenAI API (gpt-4o)...`)
    
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
        max_tokens: 4000,
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

    // Parse JSON response
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

    console.log(`✅ [${invocationId}] Analysis complete`)
    console.log(`   - Shots generated: ${analysis.shotList?.length || 0}`)
    console.log(`   - Props found: ${analysis.producingAnalysis?.keyProps?.length || 0}`)

    return res.status(200).json({
      success: true,
      analysis,
      meta: {
        sceneNumber,
        complexity,
        processingTime: openaiDuration,
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
