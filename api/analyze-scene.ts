// api/analyze-scene.ts
// PRODUCTION: Intelligent screenplay scene analysis with shot planning
// Provides narrative breakdown and actionable shot list for directors

import type { VercelRequest, VercelResponse } from '@vercel/node'

const DEPLOY_TIMESTAMP = "2024-12-13T04:00:00Z_INTELLIGENT_SHOT_PLANNING"

interface AnalyzeSceneRequest {
  sceneText: string
  sceneNumber: number
  totalScenes: number
  visualStyle?: string // Optional visual style to inject into image prompts
}

interface Shot {
  shotType: 'WIDE' | 'MEDIUM' | 'CLOSE_UP' | 'INSERT' | 'TRACKING' | 'CRANE' | 'OTHER'
  visualDescription: string
  rationale: string
  editorialIntent: string
  aiImagePrompt: string
}

interface NarrativeAnalysis {
  synopsis: string
  centralConflict: 'Argument' | 'Seduction' | 'Negotiation' | 'Confrontation' | 'Revelation' | 'Other'
  sceneTurn: string
  emotionalTone: string
  stakes: string
}

interface SceneAnalysis {
  narrativeAnalysis: NarrativeAnalysis
  shotList: Shot[]
}

export const config = {
  maxDuration: 30,
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()
  
  console.log(`\n🎬 [${invocationId}] ═══════════════════════════════`)
  console.log(`📅 Timestamp: ${new Date().toISOString()}`)
  console.log(`🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)
  console.log(`📍 Method: ${req.method}`)
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${invocationId}] CORS preflight handled`)
    return res.status(200).end()
  }
  
  // Only accept POST
  if (req.method !== 'POST') {
    console.error(`❌ [${invocationId}] Method not allowed: ${req.method}`)
    return res.status(405).json({ 
      error: 'Method not allowed',
      deployMarker: DEPLOY_TIMESTAMP 
    })
  }

  try {
    // Get OpenAI API key
    console.log(`🔑 [${invocationId}] Checking for OpenAI API key...`)
    const openaiKey = process.env.OPENAI_API_KEY
    
    if (!openaiKey) {
      console.error(`❌ [${invocationId}] OPENAI_API_KEY not found`)
      return res.status(500).json({ 
        error: 'Server configuration error: OPENAI_API_KEY not set',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    if (!openaiKey.startsWith('sk-')) {
      console.error(`❌ [${invocationId}] Invalid API key format`)
      return res.status(500).json({ 
        error: 'Server configuration error: Invalid API key format',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const keyPreview = `${openaiKey.substring(0, 7)}...${openaiKey.substring(openaiKey.length - 4)}`
    console.log(`🔑 [${invocationId}] Key found: ${keyPreview}`)

    // Parse request body
    const requestBody = req.body as AnalyzeSceneRequest
    const { sceneText, sceneNumber, totalScenes, visualStyle } = requestBody
    
    console.log(`📊 [${invocationId}] Request payload:`)
    console.log(`   - Scene: ${sceneNumber}/${totalScenes}`)
    console.log(`   - Text length: ${sceneText?.length || 0} chars`)
    console.log(`   - Visual style: ${visualStyle || 'Not specified'}`)

    // Validate inputs
    if (!sceneText || sceneNumber == null || totalScenes == null) {
      console.error(`❌ [${invocationId}] Missing required fields`)
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['sceneText', 'sceneNumber', 'totalScenes'],
        received: { 
          hasSceneText: !!sceneText, 
          sceneNumber, 
          totalScenes 
        },
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    if (sceneText.trim().length < 10) {
      console.error(`❌ [${invocationId}] Scene text too short`)
      return res.status(400).json({ 
        error: 'Scene text too short',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Build comprehensive prompt for intelligent analysis
    const systemPrompt = `You are an expert film director and cinematographer with decades of experience breaking down screenplays into actionable shot lists. Your analysis combines deep narrative understanding with practical visual storytelling techniques.

Your task is to analyze screenplay scenes and provide:
1. Deep narrative analysis (conflict, stakes, emotional turns)
2. A practical shot list that tells the story visually
3. AI-ready image prompts for pre-visualization

You understand that every shot must serve the story and that shot selection is driven by editorial intent - what we want the audience to feel or understand at each moment.`

    const userPrompt = `Analyze this scene (Scene ${sceneNumber} of ${totalScenes}) and provide a detailed breakdown:

SCENE TEXT:
${sceneText}

${visualStyle ? `\nVISUAL STYLE REQUIREMENT:\nThis production has the following visual style: "${visualStyle}"\nYou MUST incorporate this style into every AI image prompt you generate.\n` : ''}

Return a JSON object with this EXACT structure:

{
  "narrativeAnalysis": {
    "synopsis": "A 2-3 sentence narrative summary of what happens in this scene",
    "centralConflict": "Choose ONE: Argument, Seduction, Negotiation, Confrontation, Revelation, or Other",
    "sceneTurn": "Identify the specific moment/line where the scene's direction or power dynamic shifts",
    "emotionalTone": "The prevailing mood/atmosphere (e.g., tense, intimate, foreboding, triumphant)",
    "stakes": "What does the protagonist stand to lose or gain in this specific scene?"
  },
  "shotList": [
    {
      "shotType": "Choose ONE: WIDE, MEDIUM, CLOSE_UP, INSERT, TRACKING, CRANE, or OTHER",
      "visualDescription": "What the audience sees (e.g., 'Wide shot: John enters the dimly lit warehouse, his figure small against the cavernous space')",
      "rationale": "Why this specific shot is necessary for the story (e.g., 'Establishes the isolation and danger of the location')",
      "editorialIntent": "Why an editor would cut to this shot at this moment (e.g., 'Build spatial awareness before the confrontation', 'Reveal character's emotional state')",
      "aiImagePrompt": "A concise, visual prompt for AI image generation. Format: '[Shot type], [subject/action], [setting], [lighting], [mood]'${visualStyle ? `. MUST include the visual style: ${visualStyle}` : ''}"
    }
  ]
}

SHOT LIST REQUIREMENTS:
- Generate 3-6 shots per scene (more for complex scenes, fewer for simple ones)
- Start with an establishing shot (WIDE) if this is a new location
- Include reaction shots (CLOSE_UP) for emotional beats
- Use INSERT shots for important objects/details
- Each shot must have clear editorial intent
- Shot progression should follow the scene's narrative flow
- AI image prompts must be specific and visual (not abstract)

${visualStyle ? `CRITICAL: Every aiImagePrompt MUST incorporate "${visualStyle}" as part of the visual description.` : ''}

Return ONLY valid JSON. Do not include markdown formatting or explanations outside the JSON structure.`

    // Call OpenAI API
    console.log(`🤖 [${invocationId}] Calling OpenAI for intelligent scene analysis...`)
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
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.7, // Higher for creativity in shot planning
        max_tokens: 3000, // More tokens for detailed shot lists
        response_format: { type: 'json_object' }
      }),
    })

    const openaiDuration = Date.now() - openaiStartTime
    console.log(`⏱️  [${invocationId}] OpenAI responded in ${openaiDuration}ms`)
    console.log(`📡 [${invocationId}] Status: ${openaiResponse.status}`)

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error(`❌ [${invocationId}] OpenAI error (${openaiResponse.status}):`, errorText)
      return res.status(500).json({ 
        error: `OpenAI API error: ${openaiResponse.status}`,
        details: errorText,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const aiResult = await openaiResponse.json()
    
    if (!aiResult.choices || aiResult.choices.length === 0) {
      console.error(`❌ [${invocationId}] No choices in OpenAI response`)
      throw new Error('OpenAI returned no choices')
    }

    const messageContent = aiResult.choices[0].message.content
    console.log(`📄 [${invocationId}] Response length: ${messageContent.length} chars`)
    
    // Parse the analysis
    let analysis: SceneAnalysis
    try {
      analysis = JSON.parse(messageContent)
      console.log(`✅ [${invocationId}] Analysis parsed successfully`)
    } catch (parseError) {
      console.error(`❌ [${invocationId}] JSON parse failed`)
      console.error(`   Content preview: ${messageContent.substring(0, 500)}...`)
      throw new Error(`Invalid JSON from OpenAI: ${parseError instanceof Error ? parseError.message : 'Unknown'}`)
    }

    // Validate structure
    if (!analysis.narrativeAnalysis || !analysis.shotList) {
      console.error(`❌ [${invocationId}] Missing required fields in analysis`)
      console.error(`   Has narrativeAnalysis: ${!!analysis.narrativeAnalysis}`)
      console.error(`   Has shotList: ${!!analysis.shotList}`)
      throw new Error('Analysis missing required fields: narrativeAnalysis or shotList')
    }

    if (!Array.isArray(analysis.shotList)) {
      console.error(`❌ [${invocationId}] shotList is not an array`)
      throw new Error('shotList must be an array')
    }

    console.log(`✅ [${invocationId}] Narrative Analysis:`)
    console.log(`   - Conflict: ${analysis.narrativeAnalysis.centralConflict}`)
    console.log(`   - Tone: ${analysis.narrativeAnalysis.emotionalTone}`)
    console.log(`   - Synopsis: ${analysis.narrativeAnalysis.synopsis?.substring(0, 60)}...`)
    console.log(`✅ [${invocationId}] Shot List:`)
    console.log(`   - Total shots: ${analysis.shotList.length}`)
    
    // Log shot types for debugging
    const shotTypes = analysis.shotList.map(s => s.shotType).join(', ')
    console.log(`   - Shot types: ${shotTypes}`)

    // Validate each shot has required fields
    for (let i = 0; i < analysis.shotList.length; i++) {
      const shot = analysis.shotList[i]
      if (!shot.shotType || !shot.visualDescription || !shot.rationale || !shot.editorialIntent || !shot.aiImagePrompt) {
        console.error(`❌ [${invocationId}] Shot ${i + 1} missing required fields`)
        console.error(`   Shot data:`, shot)
        throw new Error(`Shot ${i + 1} is missing required fields`)
      }
    }

    // Return success
    const totalDuration = Date.now() - startTime
    console.log(`⏱️  [${invocationId}] Total: ${totalDuration}ms`)
    console.log(`✅ [${invocationId}] SUCCESS - Intelligent analysis complete`)
    console.log(`═══════════════════════════════════════════════════════\n`)

    return res.status(200).json({
      data: analysis,
      meta: {
        sceneNumber,
        totalScenes,
        visualStyle: visualStyle || null,
        shotsGenerated: analysis.shotList.length,
        processingTime: totalDuration,
        deployMarker: DEPLOY_TIMESTAMP,
        platform: 'vercel-serverless'
      }
    })

  } catch (error) {
    const totalDuration = Date.now() - startTime
    console.error(`\n💥 [${invocationId}] ═══════════════════════════════`)
    console.error(`❌ FATAL ERROR after ${totalDuration}ms`)
    console.error(`📛 Type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`)
    console.error(`📛 Message: ${error instanceof Error ? error.message : 'Unknown'}`)
    if (error instanceof Error) {
      console.error(`📛 Stack:`, error.stack)
    }
    console.error(`═══════════════════════════════════════════════════════\n`)
    
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Scene analysis failed',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      deployMarker: DEPLOY_TIMESTAMP,
      processingTime: totalDuration
    })
  }
}