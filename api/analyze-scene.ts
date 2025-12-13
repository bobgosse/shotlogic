// api/analyze-scene.ts
// Vercel Serverless Function for screenplay scene analysis

import type { VercelRequest, VercelResponse } from '@vercel/node'

const DEPLOY_TIMESTAMP = "2024-12-12T23:30:00Z_VERCEL_SERVERLESS"

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
  console.log(`🌐 Origin: ${req.headers.origin || 'none'}`)
  
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
      error: 'Method not allowed. Use POST.',
      receivedMethod: req.method,
      deployMarker: DEPLOY_TIMESTAMP 
    })
  }

  try {
    const { sceneText, sceneNumber, totalScenes } = req.body
    
    console.log(`📊 [${invocationId}] Request payload:`)
    console.log(`   - Scene: ${sceneNumber}/${totalScenes}`)
    console.log(`   - Text length: ${sceneText?.length || 0} chars`)

    // Validate inputs
    if (!sceneText || sceneNumber == null || totalScenes == null) {
      console.error(`❌ [${invocationId}] Validation failed - missing fields`)
      return res.status(400).json({ 
        error: 'Missing required fields: sceneText, sceneNumber, totalScenes',
        received: { 
          hasSceneText: !!sceneText, 
          sceneNumber, 
          totalScenes 
        },
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    if (sceneText.trim().length < 10) {
      console.error(`❌ [${invocationId}] Scene text too short: ${sceneText.length} chars`)
      return res.status(400).json({ 
        error: 'Scene text too short or empty',
        receivedLength: sceneText.length,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Get OpenAI API key from environment
    console.log(`🔑 [${invocationId}] Checking for OpenAI API key...`)
    const openaiKey = process.env.OPENAI_API_KEY
    
    if (!openaiKey) {
      console.error(`❌ [${invocationId}] OPENAI_API_KEY not found in environment`)
      return res.status(500).json({ 
        error: 'Server configuration error: OPENAI_API_KEY not set',
        details: 'The API key must be configured in Vercel environment variables',
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
    console.log(`🔑 [${invocationId}] Key found! Preview: ${keyPreview}`)

    // Call OpenAI API
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
          {
            role: 'system',
            content: 'You are a film production analyst. Extract shooting requirements from screenplay scenes. Return ONLY valid JSON with no markdown formatting.'
          },
          {
            role: 'user',
            content: `Analyze this scene (${sceneNumber} of ${totalScenes}):\n\n${sceneText}\n\nReturn a JSON object with these exact keys: location, timeOfDay, characters (array), props (array), vehicles (array), specialEquipment (array), estimatedSetupTime (string)`
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
    })

    const openaiDuration = Date.now() - openaiStartTime
    console.log(`⏱️  [${invocationId}] OpenAI responded in ${openaiDuration}ms`)
    console.log(`📡 [${invocationId}] OpenAI status: ${openaiResponse.status}`)

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error(`❌ [${invocationId}] OpenAI API error (${openaiResponse.status}):`)
      console.error(`❌ [${invocationId}] Response: ${errorText}`)
      
      return res.status(500).json({ 
        error: `OpenAI API error: ${openaiResponse.status}`,
        details: errorText,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const aiResult = await openaiResponse.json()
    console.log(`✅ [${invocationId}] OpenAI response received`)
    
    if (!aiResult.choices || aiResult.choices.length === 0) {
      console.error(`❌ [${invocationId}] No choices in OpenAI response`)
      throw new Error('OpenAI returned no choices')
    }

    const messageContent = aiResult.choices[0].message.content
    console.log(`📄 [${invocationId}] Content length: ${messageContent.length} chars`)
    
    let analysis
    try {
      analysis = JSON.parse(messageContent)
      console.log(`✅ [${invocationId}] Analysis parsed successfully`)
      console.log(`   - Location: ${analysis.location || 'N/A'}`)
      console.log(`   - Characters: ${analysis.characters?.length || 0}`)
    } catch (parseError) {
      console.error(`❌ [${invocationId}] JSON parse failed`)
      throw new Error(`Invalid JSON from OpenAI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
    }
    
    // Return success
    const totalDuration = Date.now() - startTime
    console.log(`⏱️  [${invocationId}] Total: ${totalDuration}ms`)
    console.log(`✅ [${invocationId}] SUCCESS`)
    console.log(`═══════════════════════════════════════════════════════\n`)

    return res.status(200).json({
      data: analysis,
      meta: {
        sceneNumber,
        totalScenes,
        processingTime: totalDuration,
        deployMarker: DEPLOY_TIMESTAMP,
        platform: 'vercel-serverless'
      }
    })

  } catch (error) {
    const totalDuration = Date.now() - startTime
    console.error(`\n💥 [${invocationId}] ═══════════════════════════════`)
    console.error(`❌ FATAL ERROR after ${totalDuration}ms`)
    console.error(`📛 Error:`, error)
    console.error(`═══════════════════════════════════════════════════════\n`)
    
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      deployMarker: DEPLOY_TIMESTAMP,
      processingTime: totalDuration,
      platform: 'vercel-serverless'
    })
  }
}