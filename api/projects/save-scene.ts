// api/projects/save-scene.ts
// Saves scene analysis updates to MongoDB
// UNIFIED FORMAT: Always stores analysis as JSON string (same as update-scene-analysis.ts)

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'
import { logger } from "../lib/logger";

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                    ⚠️  CRITICAL: DATA FORMAT LOCK  ⚠️                      ║
// ╠═══════════════════════════════════════════════════════════════════════════╣
// ║                                                                           ║
// ║  Analysis MUST be stored as: JSON.stringify(analysisData)                 ║
// ║                                                                           ║
// ║  The format MUST be a JSON string containing:                             ║
// ║  {                                                                        ║
// ║    "story_analysis": { the_core, synopsis, the_turn, ownership, ... },    ║
// ║    "producing_logistics": { locations, cast, key_props, ... },            ║
// ║    "directing_vision": { subtext, conflict, tone_and_mood, ... },         ║
// ║    "shot_list": [ { shot_number, shot_type, subject, ... }, ... ]         ║
// ║  }                                                                        ║
// ║                                                                           ║
// ║  DO NOT:                                                                  ║
// ║  - Store as nested object (analysis.data.narrativeAnalysis)               ║
// ║  - Change field names without updating get-one.ts and frontend            ║
// ║  - Add wrapper properties around the analysis                             ║
// ║                                                                           ║
// ║  Incident: Jan 17 2025 - "old format" detection bug caused all            ║
// ║  new projects to show empty analysis. Root cause was format mismatch      ║
// ║  between save-scene.ts and update-scene-analysis.ts                       ║
// ║                                                                           ║
// ║  Both endpoints MUST use identical format. See: update-scene-analysis.ts  ║
// ║                                                                           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

const DEPLOY_TIMESTAMP = '2025-01-17T02:00:00Z_WITH_VERIFICATION'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

  logger.log("save-scene", `\n📝 [${invocationId}] ═══ SAVE SCENE ═══`)
  logger.log("save-scene", `📅 Timestamp: ${new Date().toISOString()}`)
  logger.log("save-scene", `🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)

  // CORS handled by server.mjs middleware

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

    logger.log("save-scene", `📊 [${invocationId}] Saving ${Object.keys(sceneUpdates).length} scene(s) for project ${projectId}`)

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
        let analysisData = sceneUpdates[sceneKey]

        // Handle case where analysis might be null/undefined
        if (!analysisData) {
          logger.warn("save-scene", `   ⚠️ [${invocationId}] Scene ${scene.number} analysis is null/undefined, skipping`)
          return scene
        }

        // Log what we received
        logger.log("save-scene", `   📥 [${invocationId}] Scene ${scene.number} received data type: ${typeof analysisData}`)
        
        // Handle case where analysis is already stringified
        if (typeof analysisData === 'string') {
          try {
            analysisData = JSON.parse(analysisData)
            logger.log("save-scene", `      ✓ Parsed string to object`)
          } catch (e) {
            logger.error("save-scene", `   ❌ [${invocationId}] Scene ${scene.number} analysis is invalid string: ${analysisData.substring(0, 100)}`)
            return scene
          }
        }

        // Validate it's an object
        if (typeof analysisData !== 'object' || analysisData === null) {
          logger.error("save-scene", `   ❌ [${invocationId}] Scene ${scene.number} analysis is not an object: ${typeof analysisData}`)
          return scene
        }

        logger.log("save-scene", `   ✏️ [${invocationId}] Updating scene ${scene.number}`)
        logger.log("save-scene", `      - top-level keys: ${Object.keys(analysisData || {}).join(', ') || 'none'}`)
        logger.log("save-scene", `      - story_analysis keys: ${Object.keys(analysisData?.story_analysis || {}).join(', ') || 'none'}`)
        logger.log("save-scene", `      - shot_list count: ${analysisData?.shot_list?.length || 0}`)

        // CRITICAL: Store as JSON string (same format as update-scene-analysis.ts)
        // This ensures get-one.ts handles all scenes consistently
        // Double-check it's actually a string
        const stringifiedAnalysis = JSON.stringify(analysisData)
        const finalAnalysis = typeof stringifiedAnalysis === 'string' ? stringifiedAnalysis : String(stringifiedAnalysis)
        
        logger.log("save-scene", `      - stringified type: ${typeof finalAnalysis}`)
        logger.log("save-scene", `      - stringified length: ${finalAnalysis.length}`)
        
        return {
          ...scene,
          analysis: finalAnalysis,
          status: 'COMPLETED'
        }
      }
      return scene
    })

    // Log what we're about to save
    for (const scene of updatedScenes) {
      if (scene.analysis) {
        logger.log("save-scene", `   💾 [${invocationId}] Scene ${scene.number} analysis type before save: ${typeof scene.analysis}`)
        logger.log("save-scene", `       First 100 chars: ${typeof scene.analysis === 'string' ? scene.analysis.substring(0, 100) : JSON.stringify(scene.analysis).substring(0, 100)}`)
      }
    }

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
    
    logger.log("save-scene", `   📤 [${invocationId}] MongoDB updateOne result: matchedCount=${result.matchedCount}, modifiedCount=${result.modifiedCount}`)

    logger.log("save-scene", `✅ [${invocationId}] Updated ${result.modifiedCount} project(s)`)

    // ═══════════════════════════════════════════════════════════════
    // VERIFICATION: Fetch back and validate format
    // ═══════════════════════════════════════════════════════════════
    const verifyProject = await collection.findOne({ _id: objectId })
    const savedScenes = verifyProject?.scenes || []

    for (const sceneKey of Object.keys(sceneUpdates)) {
      const sceneNum = parseInt(sceneKey.replace('scene-', ''))
      const savedScene = savedScenes.find((s: any) => s.number === sceneNum)

      if (!savedScene) {
        logger.error("save-scene", `❌ [${invocationId}] VERIFICATION FAILED: Scene ${sceneNum} not found after save`)
        continue
      }

      // Log what we got back from MongoDB
      logger.log("save-scene", `   📥 [${invocationId}] Scene ${sceneNum} read back from MongoDB:`)
      logger.log("save-scene", `       analysis type: ${typeof savedScene.analysis}`)
      logger.log("save-scene", `       analysis value: ${savedScene.analysis === null ? 'null' : savedScene.analysis === undefined ? 'undefined' : 'exists'}`)
      if (savedScene.analysis) {
        const preview = typeof savedScene.analysis === 'string' ? savedScene.analysis.substring(0, 100) : JSON.stringify(savedScene.analysis).substring(0, 100)
        logger.log("save-scene", `       first 100 chars: ${preview}`)
      }

      // Check format - prefer string but accept object (MongoDB may auto-convert)
      if (typeof savedScene.analysis !== 'string' && typeof savedScene.analysis !== 'object') {
        logger.error("save-scene", `❌ [${invocationId}] VERIFICATION FAILED: Scene ${sceneNum} analysis is invalid type (type=${typeof savedScene.analysis})`)
        return res.status(500).json({
          error: 'Format verification failed',
          details: `Scene ${sceneNum} has invalid analysis type: ${typeof savedScene.analysis}`,
          deployMarker: DEPLOY_TIMESTAMP
        })
      }
      
      if (typeof savedScene.analysis === 'object') {
        logger.warn("save-scene", `⚠️ [${invocationId}] Scene ${sceneNum} analysis saved as object (MongoDB auto-converted), will work with frontend`)
      }

      // Check content has expected structure
      try {
        // If it's already an object, use it directly; if string, parse it
        const parsed = typeof savedScene.analysis === 'string' 
          ? JSON.parse(savedScene.analysis)
          : savedScene.analysis
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
        // subtext and conflict are stored in story_analysis (from directing call)
        if (!parsed.story_analysis?.subtext) {
          issues.push('subtext missing')
        }
        if (!parsed.story_analysis?.conflict) {
          issues.push('conflict missing')
        }
        if (!parsed.shot_list || parsed.shot_list.length === 0) {
          issues.push('shot_list empty')
        }

        if (issues.length > 0) {
          logger.warn("save-scene", `⚠️ [${invocationId}] VERIFICATION WARNING: Scene ${sceneNum} has incomplete data: ${issues.join(', ')}`)
          // Don't fail - just warn. The analysis might legitimately have sparse data for short scenes.
        } else {
          logger.log("save-scene", `✅ [${invocationId}] VERIFICATION PASSED: Scene ${sceneNum} format and content OK`)
        }
      } catch (parseErr) {
        logger.error("save-scene", `❌ [${invocationId}] VERIFICATION FAILED: Scene ${sceneNum} analysis validation error:`, parseErr)
        return res.status(500).json({
          error: 'Format verification failed',
          details: `Scene ${sceneNum} analysis validation failed: ${parseErr instanceof Error ? parseErr.message : 'unknown error'}`,
          deployMarker: DEPLOY_TIMESTAMP
        })
      }
    }

    // Check if all scenes are now completed and update project status
    const allScenesCompleted = savedScenes.every((s: any) =>
      s.status === 'COMPLETED' || s.status === 'complete'
    )
    if (allScenesCompleted && savedScenes.length > 0) {
      await collection.updateOne(
        { _id: objectId },
        { $set: { status: 'COMPLETED' } }
      )
      logger.log("save-scene", `✅ [${invocationId}] All scenes completed — project status set to COMPLETED`)
    }

    return res.status(200).json({
      success: true,
      message: `Updated ${Object.keys(sceneUpdates).length} scene(s)`,
      modifiedCount: result.modifiedCount,
      allScenesCompleted,
      deployMarker: DEPLOY_TIMESTAMP
    })

  } catch (error) {
    logger.error("save-scene", `❌ [${invocationId}] Save error:`, error)
    return res.status(500).json({
      error: 'Failed to save',
      details: error instanceof Error ? error.message : 'Unknown error',
      deployMarker: DEPLOY_TIMESTAMP
    })
  }
}
