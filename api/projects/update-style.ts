// api/projects/update-style.ts
// Updates project visual style in MongoDB
import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'
import { logger } from "../lib/logger";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS handled by server.mjs middleware
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  
  try {
    const { projectId, visualStyle } = req.body
    
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' })
    }

    const authUserId = (req as any).auth?.userId as string | undefined
    if (!authUserId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    logger.log("update-style", `🎨 Updating visual style for project ${projectId}`)

    const db = await getDb()
    const collection = db.collection('projects')
    const objectId = new ObjectId(projectId)

    const existing = await collection.findOne({ _id: objectId })
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' })
    }
    if (existing.userId && existing.userId !== authUserId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const result = await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          visual_style: visualStyle || null,
          updatedAt: new Date()
        }
      }
    )
    
    logger.log("update-style", `✅ Visual style updated, matched: ${result.matchedCount}, modified: ${result.modifiedCount}`)
    
    return res.status(200).json({
      success: true,
      message: 'Visual style updated',
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    })
  } catch (error) {
    logger.error("update-style", 'Update error:', error)
    return res.status(500).json({
      error: 'Failed to update',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
