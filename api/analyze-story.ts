import { VercelRequest, VercelResponse } from '@vercel/node'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Define the JSON structure we want the AI to return
interface StoryAnalysisResponse {
  logline: string
  mainConflict: string
  characterArcsSummary: string
  themes: string[]
  genreClassification: string
}

const ANALYZE_STORY_PROMPT = (screenplayText: string): string => `
You are an expert story analyst and film professional. Your task is to perform a high-level narrative analysis of the provided screenplay text.

Analyze the entire screenplay provided below and extract the following:
1. Logline: A concise, one-sentence summary (25 words max).
2. Main Conflict: The central, driving struggle of the story.
3. Character Arcs Summary: A brief summary of the emotional/developmental journeys for the main 3-5 characters.
4. Themes: A list of 3-5 key thematic elements explored in the story.
5. Genre Classification: The primary and secondary genre (e.g., "Neo-Noir Thriller").

Return the analysis STRICTLY as a single JSON object that conforms to the StoryAnalysisResponse TypeScript interface. DO NOT include any text outside the JSON object.

Screenplay Text:
---
${screenplayText}
---
`

export default async (request: VercelRequest, response: VercelResponse) => {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' })
  }

  // Basic validation
  const { screenplayText } = request.body
  if (!screenplayText || typeof screenplayText !== 'string') {
    return response.status(400).json({ error: 'Missing or invalid screenplayText in request body.' })
  }

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    return response.status(500).json({ error: 'OPENAI_API_KEY is not set in environment variables.' })
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using a powerful, cost-effective model for text analysis
      messages: [{ 
        role: "user", 
        content: ANALYZE_STORY_PROMPT(screenplayText) 
      }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    })

    const analysisJson = completion.choices[0].message.content
    
    if (!analysisJson) {
      throw new Error("AI returned an empty response.")
    }

    const storyAnalysis: StoryAnalysisResponse = JSON.parse(analysisJson)

    response.status(200).json({ 
      status: 'success',
      data: storyAnalysis
    })

  } catch (error) {
    console.error('OpenAI Story Analysis Error:', error)
    response.status(500).json({ 
      error: 'Failed to generate story analysis.', 
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}