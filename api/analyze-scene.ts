// api/analyze-scene.ts
// PRODUCTION: Complete scene analysis matching ALL ProjectDetails.tsx UI fields

import type { VercelRequest, VercelResponse } from '@vercel/node'

const DEPLOY_TIMESTAMP = "2024-12-25T00:30:00Z_COMPLETE_FIELDS"

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

    // Determine shot count based on complexity
    const sceneLength = sceneText.length
    const hasAction = /\b(runs?|fights?|chases?|crashes?|explodes?|falls?|grabs?|throws?|hits?|punches?|shoots?|drives?|jumps?|climbs?|escapes?)\b/i.test(sceneText)
    const dialogueMatches = sceneText.match(/^[A-Z][A-Z\s]+(?=\n)/gm) || []
    const characterCount = new Set(dialogueMatches.map(m => m.trim())).size
    
    let shotCount = "6-8"
    if (sceneLength > 1500 || hasAction || characterCount > 3) {
      shotCount = "10-15"
    } else if (sceneLength < 400) {
      shotCount = "4-6"
    }

    const systemPrompt = `You are an expert film production analyst combining story analysis, producing, and directing expertise. Return ONLY valid JSON matching the exact structure requested.`

    const userPrompt = `Analyze Scene ${sceneNumber} of ${totalScenes}.

SCENE TEXT:
${sceneText}

${visualStyle ? `VISUAL STYLE: "${visualStyle}" - use in all image prompts.` : ''}

Return this EXACT JSON structure with ALL fields filled in:

{
  "story_analysis": {
    "synopsis": "2-3 sentence summary of the scene's action and outcome",
    "stakes": "What's at risk? What could be lost or gained?",
    "ownership": "Who drives this scene? Which character has the most agency and why?",
    "breaking_point": "The turning point - quote a specific line or describe the pivotal moment that changes everything",
    "key_props": "Comma-separated list of important props (phones, documents, weapons, etc.)",
    "tone": "The emotional quality of the scene (e.g., Tense, Hopeful, Melancholic, Frantic)"
  },
  
  "producing_logistics": {
    "resource_impact": "Low or Medium or High",
    "red_flags": ["Budget concern 1", "Budget concern 2"],
    "departments_affected": ["Camera", "Art", "Sound", "Wardrobe", "Makeup", "Stunts", "VFX"],
    "locations": {
      "primary": "Main location description",
      "setting": "General setting type",
      "timeOfDay": "DAY or NIGHT or DAWN or DUSK",
      "intExt": "INT or EXT or INT/EXT"
    },
    "cast": {
      "principal": ["Main character 1", "Main character 2"],
      "speaking": ["Characters with dialogue"],
      "silent": ["Background characters with action"],
      "extras": {
        "count": "Number estimate",
        "description": "Type of extras needed"
      }
    },
    "key_props": ["prop1", "prop2", "prop3"],
    "vehicles": ["Vehicle descriptions if any"],
    "sfx": {
      "practical": ["Practical effects needed"],
      "vfx": ["VFX shots needed"],
      "stunts": ["Stunt work needed"]
    },
    "wardrobe": {
      "principal": ["Costume descriptions"],
      "notes": "Special wardrobe requirements"
    },
    "makeup": {
      "standard": ["Basic makeup notes"],
      "special": ["SFX makeup if needed"]
    },
    "scheduling": {
      "constraints": "Time or scheduling concerns",
      "notes": "Additional scheduling notes"
    }
  },
  
  "directing_vision": {
    "visual_metaphor": "Visual approach - how camera work reflects emotional content",
    "editorial_intent": "Pacing and rhythm - how the scene should be cut",
    "shot_motivation": "Why these shots serve the story",
    "subtext": "What's really being communicated beneath the surface",
    "conflict": {
      "type": "Internal or External or Both",
      "description": "Core dramatic tension - who wants what from whom",
      "resolution": "How the conflict shifts or resolves by scene end"
    },
    "tone_and_mood": {
      "opening": "How the scene opens emotionally",
      "shift": "Where and how the tone changes (if it does)",
      "closing": "How the scene ends emotionally",
      "energy": "LOW or BUILDING or HIGH or DECLINING or VOLATILE"
    },
    "visual_strategy": {
      "approach": "Overall visual philosophy (e.g., Observational, Intimate, Kinetic)",
      "camera_personality": "Objective observer, subjective POV, or character-aligned",
      "lighting_mood": "Naturalistic, expressionistic, high-key, low-key"
    },
    "character_motivations": [
      {
        "character": "Character name",
        "wants": "What they want in this scene",
        "obstacle": "What's preventing them",
        "tactic": "How they're trying to get it"
      }
    ],
    "key_moments": [
      {
        "beat": "Specific moment or line",
        "emphasis": "How to shoot it for maximum impact",
        "why": "Why this moment matters"
      }
    ],
    "performance_notes": ["Direction for actor 1", "Direction for actor 2"],
    "blocking": {
      "geography": "How characters use the space",
      "movement": "Key character movements",
      "eyelines": "Important looks or glances"
    }
  },
  
  "shot_list": [
    {
      "shot_number": 1,
      "shot_type": "WIDE or MEDIUM or CLOSE_UP or INSERT or POV or OVER_SHOULDER or TWO_SHOT",
      "movement": "STATIC or PAN or TILT or PUSH_IN or PULL_BACK or DOLLY or TRACK or HANDHELD or STEADICAM",
      "subject": "Who/what is featured",
      "action": "What happens during this shot",
      "visual": "Detailed description of what we see",
      "rationale": "Why this shot matters",
      "image_prompt": "[Shot size], [Subject], [Setting], [Lighting], [Mood]${visualStyle ? `, ${visualStyle}` : ''}"
    }
  ]
}

IMPORTANT REQUIREMENTS:
1. Fill in EVERY field - do not leave any empty or with placeholder text
2. For character_motivations, include an entry for EACH speaking character
3. For key_moments, identify 2-3 crucial beats in the scene
4. For performance_notes, give specific direction for each main actor
5. Generate ${shotCount} shots in the shot_list

Return ONLY the JSON object. No markdown, no explanation.`

    console.log(`🤖 [${invocationId}] Calling OpenAI API...`)
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
        max_tokens: 4500,
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

    console.log(`✅ [${invocationId}] Analysis complete`)
    console.log(`   - Synopsis: ${analysis.story_analysis?.synopsis?.substring(0, 50) || 'N/A'}...`)
    console.log(`   - Shots: ${analysis.shot_list?.length || 0}`)
    console.log(`   - Character motivations: ${analysis.directing_vision?.character_motivations?.length || 0}`)
    console.log(`   - Key moments: ${analysis.directing_vision?.key_moments?.length || 0}`)

    return res.status(200).json({
      success: true,
      analysis: analysis,
      meta: {
        sceneNumber,
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