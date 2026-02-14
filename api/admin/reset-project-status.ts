// api/admin/reset-project-status.ts
// Resets a project's status to allow re-analysis

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'
import { logger } from "../lib/logger";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS handled by server.mjs middleware

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { projectId } = req.body

  if (!projectId) {
    return res.status(400).json({ error: 'Missing projectId' })
  }

  try {
    const db = await getDb()
    const collection = db.collection('projects')

    // Reset project status and all scene statuses
    const result = await collection.updateOne(
      { _id: new ObjectId(projectId) },
      {
        $set: {
          status: 'COMPLETED',
          'scenes.$[].status': 'COMPLETED'
        }
      }
    )

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Project not found' })
    }

    logger.log("reset-project-status", `Reset status for project ${projectId}`)

    return res.status(200).json({
      success: true,
      message: 'Project status reset to COMPLETED',
      modifiedCount: result.modifiedCount
    })
  } catch (error) {
    logger.error("reset-project-status", "Error:", error)
    return res.status(500).json({
      error: 'Failed to reset status',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
