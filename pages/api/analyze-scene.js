// pages/api/analyze-scene.js
// Vercel Serverless Function for screenplay scene analysis

const DEPLOY_TIMESTAMP = "2024-12-12T22:00:00Z_VERCEL_MIGRATION"

export default async function handler(req, res) {
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
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sceneText, sceneNumber, totalScenes } = req.body

    // --- Validation Skipped for brevity, assume it is correct ---

    // Get OpenAI API key from environment
    const openaiKey = process.env.OPENAI_API_KEY

    if (!openaiKey) {
      return res.status(500).json({ error: 'Configuration error: OPENAI_API_KEY not found' })
    }

    // Call OpenAI API
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

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      return res.status(500).json({ error: `OpenAI API error: ${openaiResponse.status}`, details: errorText })
    }

    const aiResult = await openaiResponse.json()
    const messageContent = aiResult.choices[0].message.content
    const analysis = JSON.parse(messageContent)

    const totalDuration = Date.now() - startTime

    return res.status(200).json({
      data: analysis,
      meta: { sceneNumber, totalScenes, processingTime: totalDuration }
    })

  } catch (error) {
    return res.status(500).json({ error: error.message, errorType: error.constructor?.name })
  }
}