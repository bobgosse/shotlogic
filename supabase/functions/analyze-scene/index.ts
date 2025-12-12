import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// CRITICAL: Update timestamp for new deployment
const DEPLOY_TIMESTAMP = "2024-12-12T21:30:00Z_MOCK_BYPASS_DIAGNOSTIC"

console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`[SHOTLOGIC] Function initialized: ${DEPLOY_TIMESTAMP}`)
console.log(`[SHOTLOGIC] MODE: MOCK OPENAI BYPASS FOR DIAGNOSTICS`)
console.log(`[SHOTLOGIC] Runtime: Deno ${Deno.version.deno}`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

serve(async (req) => {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()
  
  console.log(`\n🎬 [${invocationId}] ═══════════════════════════════`)
  console.log(`📅 Timestamp: ${new Date().toISOString()}`)
  console.log(`🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)
  console.log(`🔬 Mode: DIAGNOSTIC MOCK BYPASS`)
  console.log(`📍 Method: ${req.method}`)
  console.log(`🌐 Origin: ${req.headers.get('origin') || 'none'}`)
  
  // CORS preflight
  if (req.method === "OPTIONS") {
    console.log(`✅ [${invocationId}] CORS preflight handled`)
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    })
  }

  try {
    // Parse request body
    console.log(`📥 [${invocationId}] Reading request body...`)
    let requestBody
    try {
      requestBody = await req.json()
    } catch (jsonError) {
      console.error(`❌ [${invocationId}] Failed to parse request JSON:`, jsonError)
      return new Response(
        JSON.stringify({ 
          error: "Invalid request body",
          details: "Request body must be valid JSON",
          deployMarker: DEPLOY_TIMESTAMP
        }),
        { 
          status: 400,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*" 
          }
        }
      )
    }
    
    const { sceneText, sceneNumber, totalScenes } = requestBody
    
    console.log(`📊 [${invocationId}] Request payload:`)
    console.log(`   - Scene: ${sceneNumber}/${totalScenes}`)
    console.log(`   - Text length: ${sceneText?.length || 0} chars`)
    console.log(`   - Has sceneText: ${!!sceneText}`)

    // Validate inputs
    if (!sceneText || sceneNumber == null || totalScenes == null) {
      console.error(`❌ [${invocationId}] Validation failed - missing fields`)
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields",
          received: { 
            hasSceneText: !!sceneText, 
            sceneNumber, 
            totalScenes 
          },
          deployMarker: DEPLOY_TIMESTAMP
        }),
        { 
          status: 400,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*" 
          }
        }
      )
    }

    if (sceneText.trim().length < 10) {
      console.error(`❌ [${invocationId}] Scene text too short: ${sceneText.length} chars`)
      return new Response(
        JSON.stringify({ 
          error: "Scene text too short",
          receivedLength: sceneText.length,
          deployMarker: DEPLOY_TIMESTAMP
        }),
        { 
          status: 400,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*" 
          }
        }
      )
    }

    // ============================================================
    // MOCK OPENAI RESPONSE - BYPASS ACTUAL API CALL
    // ============================================================
    console.log(`🔬 [${invocationId}] BYPASSING OpenAI API with mock response`)
    console.log(`🔬 [${invocationId}] Scene ${sceneNumber} of ${totalScenes}`)
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Generate mock analysis based on scene number
    const mockAnalysis = {
      location: `MOCK LOCATION ${sceneNumber}`,
      timeOfDay: sceneNumber % 2 === 0 ? "DAY" : "NIGHT",
      characters: [
        `Character A (Scene ${sceneNumber})`,
        `Character B (Scene ${sceneNumber})`
      ],
      props: [
        `Prop 1 for Scene ${sceneNumber}`,
        `Prop 2 for Scene ${sceneNumber}`
      ],
      vehicles: sceneNumber % 3 === 0 ? [`Vehicle for Scene ${sceneNumber}`] : [],
      specialEquipment: sceneNumber % 4 === 0 ? [`Special Equipment ${sceneNumber}`] : [],
      estimatedSetupTime: `${sceneNumber} hours`
    }
    
    console.log(`✅ [${invocationId}] Mock analysis generated`)
    console.log(`   - Location: ${mockAnalysis.location}`)
    console.log(`   - Time: ${mockAnalysis.timeOfDay}`)
    console.log(`   - Characters: ${mockAnalysis.characters.length}`)
    console.log(`   - Props: ${mockAnalysis.props.length}`)
    console.log(`   - Vehicles: ${mockAnalysis.vehicles.length}`)
    console.log(`   - Special Equipment: ${mockAnalysis.specialEquipment.length}`)
    
    // Return success with mock data
    const totalDuration = Date.now() - startTime
    console.log(`⏱️  [${invocationId}] Total: ${totalDuration}ms`)
    console.log(`✅ [${invocationId}] SUCCESS - Returning MOCK analysis`)
    console.log(`🔬 [${invocationId}] This proves pipeline works - only API key sync is the issue`)
    console.log(`═══════════════════════════════════════════════════════\n`)

    return new Response(
      JSON.stringify({
        data: mockAnalysis,
        meta: {
          sceneNumber,
          totalScenes,
          processingTime: totalDuration,
          deployMarker: DEPLOY_TIMESTAMP,
          isMockData: true,
          message: "DIAGNOSTIC MODE: Using mock data to bypass OpenAI API"
        }
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Deploy-Marker": DEPLOY_TIMESTAMP,
          "X-Processing-Time": totalDuration.toString(),
          "X-Mock-Data": "true"
        },
      }
    )

  } catch (error) {
    const totalDuration = Date.now() - startTime
    console.error(`\n💥 [${invocationId}] ═══════════════════════════════`)
    console.error(`❌ FATAL ERROR after ${totalDuration}ms`)
    console.error(`📛 Type: ${error.constructor.name}`)
    console.error(`📛 Message: ${error.message}`)
    console.error(`📛 Stack:`)
    console.error(error.stack)
    console.error(`═══════════════════════════════════════════════════════\n`)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack,
        deployMarker: DEPLOY_TIMESTAMP,
        processingTime: totalDuration
      }),
      { 
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*",
          "X-Deploy-Marker": DEPLOY_TIMESTAMP
        }
      }
    )
  }
})