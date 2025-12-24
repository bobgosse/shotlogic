// api/analyze-scene.ts
// PRODUCTION: Scene analysis matching ProjectDetails.tsx field structure

import type { VercelRequest, VercelResponse } from '@vercel/node'

const DEPLOY_TIMESTAMP = "2024-12-24T23:00:00Z_FIELD_STRUCTURE_FIX"

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
      return res.status(400).json({ 
        error: 'Missing required fields',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Determine complexity for shot count
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

    const systemPrompt = `You are an expert film production analyst combining the skills of a story analyst, line producer, and director. Analyze scenes with practical, production-ready insights.`

    const userPrompt = `Analyze Scene ${sceneNumber} of ${totalScenes}.

SCENE TEXT:
${sceneText}

${visualStyle ? `VISUAL STYLE: "${visualStyle}" - incorporate this into all image prompts.` : ''}

Return a JSON object with this EXACT structure (these field names are required):

{
  "story_analysis": {
    "stakes": "What's at risk in this scene? What could be lost or gained? Be specific.",
    "ownership": "Who owns this scene? Which character drives the action and why?",
    "breaking_point": "What's the turning point or key moment? Quote a specific line or describe the pivotal action.",
    "key_props": "List all important props mentioned or implied (phones, documents, weapons, etc.)"
  },
  
  "producing_logistics": {
    "red_flags": ["List each budget concern as a separate string", "Stunts, VFX, crowds, vehicles, special equipment", "Be specific about cost impact"],
    "resource_impact": "Low | Medium | High",
    "departments_affected": ["Camera", "Sound", "Art", "Wardrobe", "Makeup", "Stunts", "VFX", "Locations", "Extras"]
  },
  
  "directing_vision": {
    "visual_metaphor": "What's the visual approach? How does camera work reflect the emotional content?",
    "editorial_intent": "How should this scene be paced and cut? What's the rhythm?",
    "shot_motivation": "Why these shots? What story purpose does the coverage serve?"
  },
  
  "shot_list": [
    {
      "shotNumber": 1,
      "shotType": "WIDE | MEDIUM | CLOSE_UP | INSERT | POV | OVER_SHOULDER | TWO_SHOT",
      "movement": "STATIC | PAN | TILT | PUSH_IN | PULL_BACK | DOLLY | TRACK | HANDHELD | STEADICAM",
      "subject": "Who/what is featured",
      "action": "What happens during this shot",
      "visualDescription": "Detailed description of what we see",
      "rationale": "Why this shot matters to the story",
      "aiImagePrompt": "[Shot size], [Subject with action], [Detailed setting], [Lighting], [Mood]${visualStyle ? `, Style: ${visualStyle}` : ''}"
    }
  ]
}

SHOT LIST: Generate ${shotCount} shots with full coverage:
- Start with WIDE establishing shot
- Include singles for each speaking character
- Over-the-shoulder for dialogue exchanges
- Reaction shots for emotional beats
- Insert shots for props characters touch
- Vary shot sizes for editorial rhythm

Return ONLY valid JSON. No markdown, no explanation.`

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
    console.log(`   - Shots: ${analysis.shot_list?.length || 0}`)
    console.log(`   - Stakes: ${analysis.story_analysis?.stakes?.substring(0, 50) || 'N/A'}...`)

    return res.status(200).json({
      success: true,
      analysis: {
        story_analysis: analysis.story_analysis,
        producing_logistics: analysis.producing_logistics,
        directing_vision: analysis.directing_vision,
        shot_list: analysis.shot_list
      },
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