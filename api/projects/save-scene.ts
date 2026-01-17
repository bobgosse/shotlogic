// api/projects/save-scene.ts
// Saves scene analysis updates to MongoDB
// UNIFIED FORMAT: Always stores analysis as JSON string (same as update-scene-analysis.ts)

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'

const DEPLOY_TIMESTAMP = '2025-01-17T01:00:00Z_UNIFIED_STRING_FORMAT'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

  console.log(`\n📝 [${invocationId}] ═══ SAVE SCENE ═══`)
  console.log(`📅 Timestamp: ${new Date().toISOString()}`)
  console.log(`🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', deployMarker: DEPLOY_TIMESTAMP })
  }

  try {
    const { projectId, sceneUpdates } = req.body

    if (!projectId || !sceneUpdates) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'projectId and sceneUpdates are required',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    console.log(`📊 [${invocationId}] Saving ${Object.keys(sceneUpdates).length} scene(s) for project ${projectId}`)

    const db = await getDb()
    const collection = db.collection('projects')

    // Get the current project
    const objectId = new ObjectId(projectId)
    const project = await collection.findOne({ _id: objectId })

    if (!project) {
      return res.status(404).json({ error: 'Project not found', deployMarker: DEPLOY_TIMESTAMP })
    }

    // Update scenes with new analysis data - UNIFIED STRING FORMAT
    const updatedScenes = (project.scenes || []).map((scene: any) => {
      const sceneKey = `scene-${scene.number}`

      if (sceneUpdates[sceneKey]) {
        const analysisData = sceneUpdates[sceneKey]

        console.log(`   ✏️ [${invocationId}] Updating scene ${scene.number}`)
        console.log(`      - story_analysis keys: ${Object.keys(analysisData.story_analysis || {}).join(', ')}`)
        console.log(`      - shot_list count: ${analysisData.shot_list?.length || 0}`)

        // CRITICAL: Store as JSON string (same format as update-scene-analysis.ts)
        // This ensures get-one.ts handles all scenes consistently
        return {
          ...scene,
          analysis: JSON.stringify(analysisData),
          status: 'COMPLETED'
        }
      }
      return scene
    })

    // Update the project in MongoDB
    const result = await collection.updateOne(
      { _id: objectId },
      {
        $set: {
          scenes: updatedScenes,
          updatedAt: new Date()
        }
      }
    )

    console.log(`✅ [${invocationId}] Updated ${result.modifiedCount} project(s)`)

    return res.status(200).json({
      success: true,
      message: `Updated ${Object.keys(sceneUpdates).length} scene(s)`,
      modifiedCount: result.modifiedCount,
      deployMarker: DEPLOY_TIMESTAMP
    })

  } catch (error) {
    console.error(`❌ [${invocationId}] Save error:`, error)
    return res.status(500).json({
      error: 'Failed to save',
      details: error instanceof Error ? error.message : 'Unknown error',
      deployMarker: DEPLOY_TIMESTAMP
    })
  }
}
