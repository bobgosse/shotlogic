// pages/Index.tsx - CORRECTED analyzeScene function
const analyzeScene = useCallback(async (scene: Scene, totalScenes: number): Promise<SceneAnalysis> => {
    console.log(`🎬 Analyzing scene ${scene.number}/${totalScenes}`)
    
    // Perform API call
    const response = await fetch('/api/analyze-scene', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            sceneText: scene.text,
            sceneNumber: scene.number,
            totalScenes: totalScenes
        })
    })

    // CRITICAL FIX: Read the body ONLY ONCE and store it
    const responseBody = await response.text()
    
    if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`
        try {
            // Try to parse the error message from the body we already read
            const errorData = JSON.parse(responseBody) 
            errorMessage = errorData.error || errorMessage
            console.error(`Scene ${scene.number} API error:`, errorData)
        } catch (e) {
            // Use the raw text if JSON parsing fails
            errorMessage = responseBody || errorMessage
        }
        throw new Error(errorMessage)
    }

    try {
        // Parse the successful result from the body we already read
        const result = JSON.parse(responseBody)
        
        if (!result.data) {
            throw new Error('No analysis data returned')
        }

        console.log(`✅ Scene ${scene.number} analyzed successfully`)
        return result.data

    } catch (e) {
        console.error(`❌ Scene ${scene.number} JSON parsing failed:`, e)
throw new Error('Invalid JSON response from server')
}
export default Index
// ... the rest of your Index.tsx component ...