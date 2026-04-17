// api/projects/update-scene-analysis.ts
// Updates a single scene's analysis in MongoDB
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
// ║  Both endpoints MUST use identical format. See: save-scene.ts             ║
// ║                                                                           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

const DEPLOY_TIMESTAMP = '2025-01-17T02:00:00Z_WITH_VERIFICATION'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

  logger.log("update-scene-analysis", `\n📝 [${invocationId}] ═══ UPDATE SCENE ANALYSIS ═══`)
  logger.log("update-scene-analysis", `📅 Timestamp: ${new Date().toISOString()}`)
  logger.log("update-scene-analysis", `🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)

  // CORS handled by server.mjs middleware
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed', deployMarker: DEPLOY_TIMESTAMP })

  try {
    const { projectId, sceneNumber, analysis } = req.body

    if (!projectId || !sceneNumber || !analysis) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'projectId, sceneNumber, and analysis are required',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    logger.log("update-scene-analysis", `📊 [${invocationId}] Updating analysis for project ${projectId}, scene ${sceneNumber}`)

    const authUserId = (req as any).auth?.userId as string | undefined
    if (!authUserId) {
      return res.status(401).json({ error: 'Authentication required', deployMarker: DEPLOY_TIMESTAMP })
    }

    const db = await getDb()
    const collection = db.collection('projects')
    const objectId = new ObjectId(projectId)

    const project = await collection.findOne({ _id: objectId })
    if (!project) {
      return res.status(404).json({ error: 'Project not found', deployMarker: DEPLOY_TIMESTAMP })
    }

    if (project.userId && project.userId !== authUserId) {
      return res.status(403).json({ error: 'Forbidden', deployMarker: DEPLOY_TIMESTAMP })
    }

    // Extract the actual analysis data (handle nested structure from API)
    let analysisData = analysis
    if (analysis.data) {
      analysisData = analysis.data
    }

    logger.log("update-scene-analysis", `   [${invocationId}] Analysis data keys: ${Object.keys(analysisData).join(', ')}`)

    // Update the specific scene's analysis
    let matchFound = false
    const updatedScenes = (project.scenes || []).map((scene: any, index: number) => {
      const sceneNum = scene.number || scene.scene_number || (index + 1)
      const targetNum = Number(sceneNumber)
      
      if (Number(sceneNum) === targetNum) {
        matchFound = true
        logger.log("update-scene-analysis", `   ✅ [${invocationId}] Updating scene ${sceneNum}`)
        return {
          ...scene,
          // CRITICAL FIX: Stringify analysis so parseAnalysis() can JSON.parse() it
          // This matches how Index.tsx saves initial analysis
          analysis: JSON.stringify(analysisData),
          status: 'COMPLETED'
        }
      }
      return scene
    })

    if (!matchFound) {
      return res.status(404).json({
        error: 'Scene not found',
        message: `No scene with number ${sceneNumber} found`,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    await collection.updateOne(
      { _id: objectId },
      { $set: { scenes: updatedScenes, updatedAt: new Date() } }
    )

    logger.log("update-scene-analysis", `✅ [${invocationId}] Scene ${sceneNumber} analysis saved as string`)

    // ═══════════════════════════════════════════════════════════════
    // VERIFICATION: Fetch back and validate format
    // ═══════════════════════════════════════════════════════════════
    const verifyProject = await collection.findOne({ _id: objectId })
    const savedScenes = verifyProject?.scenes || []
    const savedScene = savedScenes.find((s: any) => {
      const sNum = s.number || s.scene_number
      return Number(sNum) === Number(sceneNumber)
    })

    if (!savedScene) {
      logger.error("update-scene-analysis", `❌ [${invocationId}] VERIFICATION FAILED: Scene ${sceneNumber} not found after save`)
      return res.status(500).json({
        error: 'Verification failed',
        details: `Scene ${sceneNumber} not found after save`,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Check format - must be a string
    if (typeof savedScene.analysis !== 'string') {
      logger.error("update-scene-analysis", `❌ [${invocationId}] VERIFICATION FAILED: Scene ${sceneNumber} analysis is not a string`)
      return res.status(500).json({
        error: 'Format verification failed',
        details: `Scene ${sceneNumber} saved in wrong format`,
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
        logger.warn("update-scene-analysis", `⚠️ [${invocationId}] VERIFICATION WARNING: Scene ${sceneNumber} has incomplete data: ${issues.join(', ')}`)
        // Don't fail - just warn. The analysis might legitimately have sparse data for short scenes.
      } else {
        logger.log("update-scene-analysis", `✅ [${invocationId}] VERIFICATION PASSED: Scene ${sceneNumber} format and content OK`)
      }
    } catch (parseErr) {
      logger.error("update-scene-analysis", `❌ [${invocationId}] VERIFICATION FAILED: Scene ${sceneNumber} analysis is not valid JSON`)
      return res.status(500).json({
        error: 'Format verification failed',
        details: `Scene ${sceneNumber} analysis not parseable`,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    return res.status(200).json({
      success: true,
      message: `Scene ${sceneNumber} analysis updated`,
      deployMarker: DEPLOY_TIMESTAMP
    })

  } catch (error) {
    logger.error("update-scene-analysis", `❌ [${invocationId}] Update error:`, error)
    return res.status(500).json({
      error: 'Failed to update',
      details: error instanceof Error ? error.message : 'Unknown error',
      deployMarker: DEPLOY_TIMESTAMP
    })
  }
}