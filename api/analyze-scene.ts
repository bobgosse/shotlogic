// api/analyze-scene.ts
// PRODUCTION: Intelligent screenplay scene analysis with shot planning
// CRITICAL FIX: Robust Vercel environment variable access with fallback handling

import type { VercelRequest, VercelResponse } from '@vercel/node'

const DEPLOY_TIMESTAMP = "2024-12-13T06:00:00Z_FINAL_ENV_FIX"

// ═══════════════════════════════════════════════════════════════
// HELPER: SAFE ENVIRONMENT VARIABLE ACCESS
// ═══════════════════════════════════════════════════════════════

/**
 * Safely retrieves an environment variable from process.env
 * Handles cases where process.env access might fail in serverless environments
 * @param name - The environment variable name
 * @returns The environment variable value or undefined
 */
function getEnvironmentVariable(name: string): string | undefined {
  try {
    // Attempt direct access
    if (process.env && typeof process.env === 'object') {
      const value = process.env[name]
      if (value !== undefined && value !== null) {
        return value
      }
    }
    
    // Fallback: try bracket notation
    const env = process.env as { [key: string]: string | undefined }
    if (env[name]) {
      return env[name]
    }
    
    // Fallback: try case-insensitive lookup (some platforms)
    const envKeys = Object.keys(process.env)
    const matchingKey = envKeys.find(k => k.toLowerCase() === name.toLowerCase())
    if (matchingKey && process.env[matchingKey]) {
      return process.env[matchingKey]
    }
    
    return undefined
  } catch (error) {
    console.error(`Failed to access environment variable "${name}":`, error)
    return undefined
  }
}

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

interface AnalyzeSceneRequest {
  sceneText: string
  sceneNumber: number
  totalScenes: number
  visualStyle?: string
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

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

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
  console.log(`🌍 Environment: ${getEnvironmentVariable('VERCEL_ENV') || 'unknown'}`)
  
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
      message: 'This endpoint only accepts POST requests',
      deployMarker: DEPLOY_TIMESTAMP 
    })
  }

  try {
    // ═══════════════════════════════════════════════════════════════
    // CRITICAL: ENHANCED OPENAI API KEY VALIDATION
    // ═══════════════════════════════════════════════════════════════
    
    console.log(`🔑 [${invocationId}] ═══ AUTHENTICATION CHECK ═══`)
    console.log(`🔑 [${invocationId}] Attempting to load environment variables...`)
    
    // Step 1: Check process.env accessibility
    try {
      const envTest = process.env
      console.log(`🔑 [${invocationId}] process.env is accessible: ${typeof envTest === 'object'}`)
      console.log(`🔑 [${invocationId}] Total env vars available: ${Object.keys(envTest).length}`)
    } catch (envAccessError) {
      console.error(`❌ [${invocationId}] CRITICAL: Cannot access process.env:`, envAccessError)
      return res.status(500).json({
        error: 'Server Configuration Error',
        message: 'Cannot access server environment',
        technicalDetails: 'process.env object is not accessible',
        troubleshooting: 'This is a critical server configuration issue. Please contact Vercel support.',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    // Step 2: Attempt to retrieve OpenAI API key using helper function
    console.log(`🔑 [${invocationId}] Retrieving OPENAI_API_KEY...`)
    const openaiKey = getEnvironmentVariable('OPENAI_API_KEY')
    
    console.log(`🔑 [${invocationId}] OPENAI_API_KEY status: ${openaiKey ? 'FOUND' : 'NOT FOUND'}`)
    
    if (!openaiKey) {
      console.error(`❌ [${invocationId}] OPENAI_API_KEY is not set in environment`)
      
      // Debug: List all available environment variables (excluding sensitive ones)
      try {
        const availableEnvVars = Object.keys(process.env)
          .filter(k => !k.toLowerCase().includes('secret') && 
                      !k.toLowerCase().includes('key') && 
                      !k.toLowerCase().includes('token'))
          .sort()
        
        console.error(`❌ [${invocationId}] Available (non-sensitive) env vars (${availableEnvVars.length}):`)
        console.error(`   ${availableEnvVars.slice(0, 20).join(', ')}${availableEnvVars.length > 20 ? '...' : ''}`)
        
        // Check if any OpenAI-related vars exist
        const openaiRelated = Object.keys(process.env)
          .filter(k => k.toLowerCase().includes('openai'))
        
        if (openaiRelated.length > 0) {
          console.error(`❌ [${invocationId}] OpenAI-related vars found: ${openaiRelated.join(', ')}`)
        } else {
          console.error(`❌ [${invocationId}] No OpenAI-related environment variables found`)
        }
      } catch (debugError) {
        console.error(`❌ [${invocationId}] Cannot enumerate environment variables:`, debugError)
      }
      
      return res.status(500).json({ 
        error: 'Server Configuration Error',
        message: 'OpenAI API Key is not configured',
        technicalDetails: 'OPENAI_API_KEY environment variable is not set or not accessible in this Vercel deployment',
        troubleshooting: [
          '1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables',
          '2. Add OPENAI_API_KEY with your OpenAI API key',
          '3. Ensure it is enabled for Production, Preview, and Development environments',
          '4. Redeploy your application after saving the environment variable',
          '5. If the variable is already set, try removing and re-adding it'
        ],
        vercelDocs: 'https://vercel.com/docs/concepts/projects/environment-variables',
        deployMarker: DEPLOY_TIMESTAMP,
        timestamp: new Date().toISOString()
      })
    }
    
    // Step 3: Validate key length
    if (openaiKey.length < 20) {
      console.error(`❌ [${invocationId}] OPENAI_API_KEY too short: ${openaiKey.length} characters`)
      console.error(`❌ [${invocationId}] Key preview (first 20 chars): ${openaiKey.substring(0, 20)}`)
      
      return res.status(500).json({
        error: 'Server Configuration Error',
        message: 'OpenAI API Key appears to be invalid (too short)',
        technicalDetails: `Actual key length: ${openaiKey.length} characters (expected 50+ characters)`,
        troubleshooting: [
          'The API key stored in Vercel may be incomplete or corrupted',
          'Please verify the complete API key was copied correctly',
          'OpenAI API keys are typically 51+ characters long',
          'Try removing and re-adding the environment variable in Vercel'
        ],
        deployMarker: DEPLOY_TIMESTAMP,
        timestamp: new Date().toISOString()
      })
    }
    
    // Step 4: Validate key prefix
    const hasValidPrefix = openaiKey.startsWith('sk-proj-') || openaiKey.startsWith('sk-')
    
    if (!hasValidPrefix) {
      const keyStart = openaiKey.substring(0, Math.min(15, openaiKey.length))
      console.error(`❌ [${invocationId}] OPENAI_API_KEY has invalid prefix`)
      console.error(`❌ [${invocationId}] Key starts with: ${keyStart}`)
      console.error(`❌ [${invocationId}] Expected prefix: "sk-" or "sk-proj-"`)
      
      return res.status(500).json({
        error: 'Server Configuration Error',
        message: 'OpenAI API Key format is invalid',
        technicalDetails: `Key does not start with required prefix (sk- or sk-proj-). Instead starts with: ${keyStart}`,
        troubleshooting: [
          'OpenAI API keys must start with "sk-" (legacy) or "sk-proj-" (project keys)',
          'Please verify you copied the correct key from platform.openai.com/api-keys',
          'Make sure you did not accidentally copy a different credential or token',
          'Regenerate the API key on OpenAI and update it in Vercel'
        ],
        deployMarker: DEPLOY_TIMESTAMP,
        timestamp: new Date().toISOString()
      })
    }
    
    // Step 5: Success - log sanitized key info
    const keyPrefix = openaiKey.startsWith('sk-proj-') ? 'sk-proj-' : 'sk-'
    const keyPreview = `${openaiKey.substring(0, 12)}...${openaiKey.substring(openaiKey.length - 4)}`
    const keyLength = openaiKey.length
    
    console.log(`✅ [${invocationId}] API Key validation PASSED`)
    console.log(`🔑 [${invocationId}] Key format: ${keyPrefix}`)
    console.log(`🔑 [${invocationId}] Key length: ${keyLength} characters`)
    console.log(`🔑 [${invocationId}] Key preview: ${keyPreview}`)
    console.log(`🔑 [${invocationId}] ═══════════════════════════════`)

    // ═══════════════════════════════════════════════════════════════
    // PARSE AND VALIDATE REQUEST BODY
    // ═══════════════════════════════════════════════════════════════
    
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
        message: 'Request must include sceneText, sceneNumber, and totalScenes',
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
      console.error(`❌ [${invocationId}] Scene text too short: ${sceneText.length} chars`)
      return res.status(400).json({ 
        error: 'Scene text too short',
        message: 'Scene text must be at least 10 characters',
        receivedLength: sceneText.length,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // ═══════════════════════════════════════════════════════════════
    // BUILD ANALYSIS PROMPTS
    // ═══════════════════════════════════════════════════════════════
    
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

    // ═══════════════════════════════════════════════════════════════
    // CALL OPENAI API WITH ENHANCED ERROR HANDLING
    // ═══════════════════════════════════════════════════════════════
    
    console.log(`🤖 [${invocationId}] Calling OpenAI API...`)
    console.log(`🤖 [${invocationId}] Model: gpt-4o`)
    console.log(`🤖 [${invocationId}] Max tokens: 3000`)
    
    const openaiStartTime = Date.now()
    
    let openaiResponse
    try {
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
          temperature: 0.7,
          max_tokens: 3000,
          response_format: { type: 'json_object' }
        }),
      })
    } catch (fetchError) {
      console.error(`❌ [${invocationId}] Network error calling OpenAI:`, fetchError)
      return res.status(500).json({
        error: 'Network Error',
        message: 'Failed to connect to OpenAI API',
        technicalDetails: fetchError instanceof Error ? fetchError.message : 'Unknown network error',
        troubleshooting: 'This may be a temporary network issue. Please try again.',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const openaiDuration = Date.now() - openaiStartTime
    console.log(`⏱️  [${invocationId}] OpenAI responded in ${openaiDuration}ms`)
    console.log(`📡 [${invocationId}] Status: ${openaiResponse.status}`)

    // Enhanced error handling for OpenAI API responses
    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error(`❌ [${invocationId}] OpenAI API error (${openaiResponse.status})`)
      console.error(`❌ [${invocationId}] Response: ${errorText}`)
      
      // Check for specific error types
      if (openaiResponse.status === 401) {
        console.error(`❌ [${invocationId}] AUTHENTICATION FAILED WITH OPENAI`)
        console.error(`❌ [${invocationId}] The API key was rejected by OpenAI servers`)
        console.error(`❌ [${invocationId}] Key used: ${keyPreview}`)
        
        return res.status(500).json({ 
          error: 'OpenAI Authentication Failed',
          message: 'The OpenAI API key was rejected by OpenAI servers',
          technicalDetails: `HTTP ${openaiResponse.status}: ${errorText}`,
          troubleshooting: [
            'The API key in Vercel environment variables was rejected by OpenAI',
            'This could mean the key is invalid, expired, revoked, or has no credits',
            'Go to platform.openai.com/api-keys to verify the key status',
            'Check platform.openai.com/account/usage to verify you have credits/quota',
            'Try regenerating the API key and updating it in Vercel',
            'Ensure the key has proper permissions for GPT-4 access'
          ],
          httpStatus: openaiResponse.status,
          keyUsed: keyPreview,
          deployMarker: DEPLOY_TIMESTAMP
        })
      } else if (openaiResponse.status === 429) {
        console.error(`❌ [${invocationId}] RATE LIMIT EXCEEDED`)
        
        return res.status(429).json({
          error: 'Rate Limit Exceeded',
          message: 'OpenAI API rate limit reached',
          technicalDetails: errorText,
          troubleshooting: 'Your OpenAI account has exceeded its rate limits. Please wait before trying again or upgrade your plan.',
          deployMarker: DEPLOY_TIMESTAMP
        })
      } else if (openaiResponse.status === 403) {
        console.error(`❌ [${invocationId}] FORBIDDEN - Insufficient permissions or quota`)
        
        return res.status(500).json({
          error: 'OpenAI Access Denied',
          message: 'Access to OpenAI API denied',
          technicalDetails: errorText,
          troubleshooting: 'Your API key may not have permission to access GPT-4, or your account may be out of credits. Check platform.openai.com/account/usage',
          deployMarker: DEPLOY_TIMESTAMP
        })
      } else {
        return res.status(500).json({ 
          error: `OpenAI API Error (${openaiResponse.status})`,
          message: 'OpenAI API returned an error',
          technicalDetails: errorText,
          httpStatus: openaiResponse.status,
          deployMarker: DEPLOY_TIMESTAMP
        })
      }
    }

    const aiResult = await openaiResponse.json()
    
    if (!aiResult.choices || aiResult.choices.length === 0) {
      console.error(`❌ [${invocationId}] No choices in OpenAI response`)
      console.error(`❌ [${invocationId}] Full response:`, JSON.stringify(aiResult))
      throw new Error('OpenAI returned no choices')
    }

    const messageContent = aiResult.choices[0].message.content
    console.log(`📄 [${invocationId}] Response length: ${messageContent.length} chars`)
    
    // ═══════════════════════════════════════════════════════════════
    // PARSE AND VALIDATE ANALYSIS
    // ═══════════════════════════════════════════════════════════════
    
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
      throw new Error('Analysis missing required fields: narrativeAnalysis or shotList')
    }

    if (!Array.isArray(analysis.shotList)) {
      console.error(`❌ [${invocationId}] shotList is not an array`)
      throw new Error('shotList must be an array')
    }

    console.log(`✅ [${invocationId}] Narrative Analysis:`)
    console.log(`   - Conflict: ${analysis.narrativeAnalysis.centralConflict}`)
    console.log(`   - Tone: ${analysis.narrativeAnalysis.emotionalTone}`)
    console.log(`✅ [${invocationId}] Shot List:`)
    console.log(`   - Total shots: ${analysis.shotList.length}`)

    // Validate each shot
    for (let i = 0; i < analysis.shotList.length; i++) {
      const shot = analysis.shotList[i]
      if (!shot.shotType || !shot.visualDescription || !shot.rationale || !shot.editorialIntent || !shot.aiImagePrompt) {
        console.error(`❌ [${invocationId}] Shot ${i + 1} missing required fields`)
        throw new Error(`Shot ${i + 1} is missing required fields`)
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // RETURN SUCCESS
    // ═══════════════════════════════════════════════════════════════
    
    const totalDuration = Date.now() - startTime
    console.log(`⏱️  [${invocationId}] Total: ${totalDuration}ms`)
    console.log(`✅ [${invocationId}] SUCCESS - Scene analysis complete`)
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
      error: 'Scene Analysis Failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      deployMarker: DEPLOY_TIMESTAMP,
      processingTime: totalDuration
    })
  }
}