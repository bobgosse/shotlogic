// api/projects/save-scene.ts
// Saves scene analysis updates to MongoDB
// UNIFIED FORMAT: Always stores analysis as JSON string (same as update-scene-analysis.ts)

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'

const DEPLOY_TIMESTAMP = '2025-01-17T02:00:00Z_WITH_VERIFICATION'

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

    // ═══════════════════════════════════════════════════════════════
    // VERIFICATION: Fetch back and validate format
    // ═══════════════════════════════════════════════════════════════
    const verifyProject = await collection.findOne({ _id: objectId })
    const savedScenes = verifyProject?.scenes || []

    for (const sceneKey of Object.keys(sceneUpdates)) {
      const sceneNum = parseInt(sceneKey.replace('scene-', ''))
      const savedScene = savedScenes.find((s: any) => s.number === sceneNum)

      if (!savedScene) {
        console.error(`❌ [${invocationId}] VERIFICATION FAILED: Scene ${sceneNum} not found after save`)
        continue
      }

      // Check format - must be a string
      if (typeof savedScene.analysis !== 'string') {
        console.error(`❌ [${invocationId}] VERIFICATION FAILED: Scene ${sceneNum} analysis is not a string`)
        return res.status(500).json({
          error: 'Format verification failed',
          details: `Scene ${sceneNum} saved in wrong format`,
          deployMarker: DEPLOY_TIMESTAMP
        })
      }

      // Check content is valid JSON with expected structure
      try {
        const parsed = JSON.parse(savedScene.analysis)
        const issues: string[] = []

        if (!parsed.story_analysis?.the_turn || parsed.story_analysis.the_turn.length < 20) {
          issues.push('the_turn empty or too short')
        }
        if (!parsed.story_analysis?.the_core || parsed.story_analysis.the_core.length < 20) {
          issues.push('the_core empty or too short')
        }
        if (!parsed.producing_logistics?.locations) {
          issues.push('locations missing')
        }
        if (!parsed.story_analysis?.subtext) {
          issues.push('subtext missing')
        }
        if (!parsed.shot_list || parsed.shot_list.length === 0) {
          issues.push('shot_list empty')
        }

        if (issues.length > 0) {
          console.warn(`⚠️ [${invocationId}] VERIFICATION WARNING: Scene ${sceneNum} has incomplete data: ${issues.join(', ')}`)
          // Don't fail - just warn. The analysis might legitimately have sparse data for short scenes.
        } else {
          console.log(`✅ [${invocationId}] VERIFICATION PASSED: Scene ${sceneNum} format and content OK`)
        }
      } catch (parseErr) {
        console.error(`❌ [${invocationId}] VERIFICATION FAILED: Scene ${sceneNum} analysis is not valid JSON`)
        return res.status(500).json({
          error: 'Format verification failed',
          details: `Scene ${sceneNum} analysis not parseable`,
          deployMarker: DEPLOY_TIMESTAMP
        })
      }
    }

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
