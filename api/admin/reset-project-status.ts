// api/admin/reset-project-status.ts
// Resets a project's status to allow re-analysis
// By default only resets the project-level status, preserving scene statuses.
// Pass resetScenes: true to also mark all scenes as COMPLETED.
// Pass resetErrorScenes: true to reset only ERROR scenes back to PENDING.

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'
import { logger } from "../lib/logger";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS handled by server.mjs middleware

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { projectId, resetScenes, resetErrorScenes } = req.body

  if (!projectId) {
    return res.status(400).json({ error: 'Missing projectId' })
  }

  try {
    const db = await getDb()
    const collection = db.collection('projects')

    // Always reset project-level status so the UI unblocks
    const update: any = { $set: { status: 'COMPLETED' } }

    if (resetScenes) {
      // Nuclear option: mark all scenes as COMPLETED
      update.$set['scenes.$[].status'] = 'COMPLETED'
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(projectId) },
      update
    )

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Optionally reset ERROR scenes back to PENDING so they can be retried
    let errorScenesReset = 0
    if (resetErrorScenes) {
      const errorResult = await collection.updateOne(
        { _id: new ObjectId(projectId) },
        { $set: { 'scenes.$[elem].status': 'PENDING' } },
        { arrayFilters: [{ 'elem.status': 'ERROR' }] }
      )
      errorScenesReset = errorResult.modifiedCount
    }

    // Get current scene status summary
    const project = await collection.findOne(
      { _id: new ObjectId(projectId) },
      { projection: { scenes: 1 } }
    )
    const sceneSummary = {
      total: project?.scenes?.length || 0,
      completed: project?.scenes?.filter((s: any) => s.status === 'COMPLETED').length || 0,
      pending: project?.scenes?.filter((s: any) => s.status === 'PENDING').length || 0,
      error: project?.scenes?.filter((s: any) => s.status === 'ERROR').length || 0,
    }

    logger.log("reset-project-status", `Reset status for project ${projectId}`, sceneSummary)

    return res.status(200).json({
      success: true,
      message: 'Project status reset to COMPLETED',
      modifiedCount: result.modifiedCount,
      errorScenesReset,
      sceneSummary
    })
  } catch (error) {
    logger.error("reset-project-status", "Error:", error)
    return res.status(500).json({
      error: 'Failed to reset status',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
