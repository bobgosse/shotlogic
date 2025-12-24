// api/analyze-scene.ts
// PRODUCTION: Scene analysis matching FULL ProjectDetails.tsx UI structure

import type { VercelRequest, VercelResponse } from '@vercel/node'

const DEPLOY_TIMESTAMP = "2024-12-24T23:45:00Z_FULL_STRUCTURE"

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

    const systemPrompt = `You are an expert film production analyst. Return ONLY valid JSON matching the exact structure requested. No markdown, no explanation.`

    const userPrompt = `Analyze Scene ${sceneNumber} of ${totalScenes}.

SCENE TEXT:
${sceneText}

${visualStyle ? `VISUAL STYLE: "${visualStyle}" - use in all image prompts.` : ''}

Return this EXACT JSON structure:

{
  "story_analysis": {
    "synopsis": "2-3 sentence summary of what happens in this scene",
    "stakes": "What's at risk? What could be lost or gained?",
    "ownership": "Who drives this scene and why?",
    "breaking_point": "The turning point - quote a line or describe the pivotal moment",
    "key_props": "Comma-separated list of important props"
  },
  
  "producing_logistics": {
    "resource_impact": "Low",
    "red_flags": ["Budget concern 1", "Budget concern 2"],
    "departments_affected": ["Camera", "Art", "Sound"],
    "locations": {
      "primary": "Main location description",
      "setting": "General setting type",
      "timeOfDay": "DAY or NIGHT or DAWN or DUSK",
      "intExt": "INT or EXT or INT/EXT"
    },
    "cast": {
      "principal": ["Character 1", "Character 2"],
      "speaking": ["Characters with dialogue"],
      "silent": ["Background characters"],
      "extras": {
        "count": "Number estimate",
        "description": "Type of extras needed"
      }
    },
    "key_props": ["prop1", "prop2", "prop3"],
    "vehicles": ["Vehicle 1 if any"],
    "sfx": {
      "practical": ["Practical effects needed"],
      "vfx": ["VFX shots needed"],
      "stunts": ["Stunt work needed"]
    },
    "wardrobe": {
      "principal": ["Costume descriptions"],
      "notes": "Special wardrobe needs"
    },
    "makeup": {
      "standard": ["Basic makeup notes"],
      "special": ["SFX makeup if needed"]
    },
    "scheduling": {
      "constraints": "Time/scheduling concerns",
      "notes": "Additional scheduling notes"
    }
  },
  
  "directing_vision": {
    "visual_metaphor": "Visual approach and how camera reflects emotion",
    "editorial_intent": "Pacing and rhythm notes",
    "shot_motivation": "Why these shots serve the story",
    "conflict": {
      "type": "Internal or External or Both",
      "description": "Core dramatic tension",
      "resolution": "How it resolves or shifts"
    },
    "tone_and_mood": {
      "opening": "How scene opens emotionally",
      "shift": "Where/how tone changes",
      "closing": "How scene ends emotionally",
      "energy": "LOW or BUILDING or HIGH or DECLINING"
    },
    "blocking": {
      "geography": "How characters use space",
      "movement": "Key movements",
      "eyelines": "Important looks/glances"
    },
    "performance_notes": ["Note for actor 1", "Note for actor 2"]
  },
  
  "shot_list": [
    {
      "shotNumber": 1,
      "shotType": "WIDE",
      "movement": "STATIC",
      "subject": "Full scene establishing",
      "action": "What happens",
      "visualDescription": "What we see in detail",
      "rationale": "Why this shot",
      "aiImagePrompt": "[Shot size], [Subject], [Setting], [Lighting], [Mood]${visualStyle ? `, ${visualStyle}` : ''}"
    }
  ]
}

Generate ${shotCount} shots in shot_list. Use "Low", "Medium", or "High" for resource_impact.

Return ONLY the JSON object. No markdown code blocks.`

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
    console.log(`   - Impact: ${analysis.producing_logistics?.resource_impact || 'N/A'}`)

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