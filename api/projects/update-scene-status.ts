// api/projects/update-scene-status.ts
// Updates a scene's status without requiring analysis data
// Used to mark scenes as ERROR when analysis fails

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'
import { logger } from "../lib/logger";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS handled by server.mjs middleware
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { projectId, sceneNumber, status, error: errorMessage } = req.body

    if (!projectId || sceneNumber === undefined || !status) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'projectId, sceneNumber, and status are required'
      })
    }

    logger.log("update-scene-status", `Updating scene ${sceneNumber} status to ${status} for project ${projectId}`)

    const db = await getDb()
    const collection = db.collection('projects')
    const objectId = new ObjectId(projectId)

    const project = await collection.findOne({ _id: objectId })
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Update the specific scene's status
    let matchFound = false
    const updatedScenes = (project.scenes || []).map((scene: any, index: number) => {
      const sceneNum = scene.number || scene.scene_number || (index + 1)
      const targetNum = Number(sceneNumber)

      if (Number(sceneNum) === targetNum) {
        matchFound = true
        logger.log("update-scene-status", `Updating scene ${sceneNum} status: ${scene.status} -> ${status}`)
        return {
          ...scene,
          status,
          error: errorMessage || null,
          updatedAt: new Date().toISOString()
        }
      }
      return scene
    })

    if (!matchFound) {
      return res.status(404).json({
        error: 'Scene not found',
        message: `No scene with number ${sceneNumber} found`
      })
    }

    await collection.updateOne(
      { _id: objectId },
      { $set: { scenes: updatedScenes, updatedAt: new Date() } }
    )

    logger.log("update-scene-status", `Scene ${sceneNumber} status updated to ${status}`)

    return res.status(200).json({
      success: true,
      message: `Scene ${sceneNumber} status updated to ${status}`
    })

  } catch (error) {
    logger.error("update-scene-status", "Error:", error)
    return res.status(500).json({
      error: 'Failed to update status',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
