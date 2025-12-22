import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { sceneContent, instructions } = req.body
    
    // For now, this is a placeholder that returns the content back
    // We will connect this to the AI in the next step
    return res.status(200).json({ 
      analysis: `Analysis placeholder for: ${sceneContent.substring(0, 50)}...`,
      status: "Success"
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
}
