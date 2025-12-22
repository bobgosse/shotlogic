// api/analyze-story.ts
// Vercel Serverless Function for analyzing overall screenplay story structure

import type { VercelRequest, VercelResponse } from '@vercel/node'

const DEPLOY_TIMESTAMP = "2024-12-13T01:00:00Z_STORY_ANALYZER"
const MAX_TEXT_LENGTH = 100000 // 100k characters max

interface StoryAnalysisRequest {
  screenplayText: string
  title?: string
}

// CRITICAL FIX: Set maxDuration to prevent Vercel timeouts for large analysis tasks
export const config = {
  maxDuration: 60, // Allow up to 60 seconds for story analysis
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()
  
  console.log(`\n📚 [${invocationId}] ═══════════════════════════════`)
  console.log(`📅 Timestamp: ${new Date().toISOString()}`)
  console.log(`🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed. Use POST.',
      deployMarker: DEPLOY_TIMESTAMP 
    })
  }

  try {
    // CRITICAL FIX: Get OpenAI API key INSIDE the handler and check explicitly
    let openaiKey: string | undefined
    
    try {
      openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY
    } catch (envError) {
      console.error(`❌ [${invocationId}] Environment access error:`, envError)
    }
    
    if (!openaiKey) {
      console.error(`❌ [${invocationId}] OPENAI_API_KEY not found`)
      return res.status(500).json({ 
        error: 'Server configuration error: OPENAI_API_KEY not set',
        details: 'The OpenAI API key must be configured in Vercel environment variables',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    // Parse request body
    let requestBody: StoryAnalysisRequest
    try {
      requestBody = req.body
    } catch (jsonError) {
      console.error(`❌ [${invocationId}] Failed to parse request JSON:`, jsonError)
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: 'Request body must be valid JSON',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    const { screenplayText, title } = requestBody
    
    // Validate inputs
    if (!screenplayText) {
      return res.status(400).json({ 
        error: 'Missing required field: screenplayText',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    if (screenplayText.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ 
        error: 'Screenplay text too long',
        maxLength: MAX_TEXT_LENGTH,
        receivedLength: screenplayText.length,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    if (screenplayText.trim().length < 500) {
      return res.status(400).json({ 
        error: 'Screenplay text too short for story analysis',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Call OpenAI API - USING FETCH (NOT SDK) for maximum compatibility on Vercel
    const prompt = `Analyze this ${title ? `screenplay titled "${title}"` : 'screenplay'}:\n\n${screenplayText}\n\nReturn a JSON object with these keys:\n- logline (string): One-sentence story summary\n- genre (string): Primary genre\n- themes (array of strings): Major themes\n- protagonist (string): Main character name and brief description\n- antagonist (string): Main opposing force\n- acts (object): Three-act structure breakdown with act1, act2, act3 keys, each containing a brief summary\n- tone (string): Overall tone/mood\n- estimatedBudget (string): Rough budget category (low/medium/high)\n- targetAudience (string): Primary demographic\n- uniqueSellingPoint (string): What makes this story distinctive`
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o', // Use a robust model for comprehensive analysis
          messages: [
            {
              role: 'system',
              content: 'You are an expert screenplay analyst. Analyze the overall story structure, themes, and narrative arc of the screenplay. Return ONLY valid JSON with no markdown formatting.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.5,
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      return res.status(500).json({ 
        error: `OpenAI API error: ${openaiResponse.status}`,
        details: errorText,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const aiResult = await openaiResponse.json()
    const messageContent = aiResult.choices?.[0]?.message.content
    
    if (!messageContent) {
      throw new Error('OpenAI returned no valid message content')
    }
    
    let storyAnalysis
    try {
      storyAnalysis = JSON.parse(messageContent)
    } catch (parseError) {
      throw new Error(`Invalid JSON from OpenAI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
    }
    
    // Return success
    const totalDuration = Date.now() - startTime
    return res.status(200).json({
      data: storyAnalysis,
      meta: {
        title: title || 'Untitled',
        textLength: screenplayText.length,
        processingTime: totalDuration,
        deployMarker: DEPLOY_TIMESTAMP,
        platform: 'vercel-serverless'
      }
    })

  } catch (error) {
    const totalDuration = Date.now() - startTime
    
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Story analysis failed',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      deployMarker: DEPLOY_TIMESTAMP,
      processingTime: totalDuration,
      platform: 'vercel-serverless'
    })
  }
}