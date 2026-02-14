// api/projects/update-characters.ts
// Updates project character definitions in MongoDB
import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'
import { logger } from "../lib/logger";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS handled by server.mjs middleware
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  
  try {
    const { projectId, characters } = req.body
    
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' })
    }
    
    logger.log("update-characters", "👥 Updating characters for project", projectId)
    logger.log("update-characters", "   Character count:", characters?.length || 0)
    
    const db = await getDb()
    const collection = db.collection('projects')
    
    const result = await collection.updateOne(
      { _id: new ObjectId(projectId) },
      { 
        $set: { 
          characters: characters || [],
          updatedAt: new Date()
        }
      }
    )
    
    logger.log("update-characters", "✅ Characters updated, modified:", result.modifiedCount)
    
    return res.status(200).json({
      success: true,
      message: 'Characters updated',
      modifiedCount: result.modifiedCount
    })
  } catch (error) {
    logger.error("update-characters", 'Update error:', error)
    return res.status(500).json({
      error: 'Failed to update',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
