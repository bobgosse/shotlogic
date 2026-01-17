// api/projects/update-scene-analysis.ts
// Updates a single scene's analysis in MongoDB
import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'

const DEPLOY_TIMESTAMP = '2025-01-17T02:00:00Z_WITH_VERIFICATION'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

  console.log(`\n📝 [${invocationId}] ═══ UPDATE SCENE ANALYSIS ═══`)
  console.log(`📅 Timestamp: ${new Date().toISOString()}`)
  console.log(`🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
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

    console.log(`📊 [${invocationId}] Updating analysis for project ${projectId}, scene ${sceneNumber}`)

    const db = await getDb()
    const collection = db.collection('projects')
    const objectId = new ObjectId(projectId)

    const project = await collection.findOne({ _id: objectId })
    if (!project) {
      return res.status(404).json({ error: 'Project not found', deployMarker: DEPLOY_TIMESTAMP })
    }

    // Extract the actual analysis data (handle nested structure from API)
    let analysisData = analysis
    if (analysis.data) {
      analysisData = analysis.data
    }

    console.log(`   [${invocationId}] Analysis data keys: ${Object.keys(analysisData).join(', ')}`)

    // Update the specific scene's analysis
    let matchFound = false
    const updatedScenes = (project.scenes || []).map((scene: any, index: number) => {
      const sceneNum = scene.number || scene.scene_number || (index + 1)
      const targetNum = Number(sceneNumber)
      
      if (Number(sceneNum) === targetNum) {
        matchFound = true
        console.log(`   ✅ [${invocationId}] Updating scene ${sceneNum}`)
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

    console.log(`✅ [${invocationId}] Scene ${sceneNumber} analysis saved as string`)

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
      console.error(`❌ [${invocationId}] VERIFICATION FAILED: Scene ${sceneNumber} not found after save`)
      return res.status(500).json({
        error: 'Verification failed',
        details: `Scene ${sceneNumber} not found after save`,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Check format - must be a string
    if (typeof savedScene.analysis !== 'string') {
      console.error(`❌ [${invocationId}] VERIFICATION FAILED: Scene ${sceneNumber} analysis is not a string`)
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
      if (!parsed.story_analysis?.subtext) {
        issues.push('subtext missing')
      }
      if (!parsed.shot_list || parsed.shot_list.length === 0) {
        issues.push('shot_list empty')
      }

      if (issues.length > 0) {
        console.warn(`⚠️ [${invocationId}] VERIFICATION WARNING: Scene ${sceneNumber} has incomplete data: ${issues.join(', ')}`)
        // Don't fail - just warn. The analysis might legitimately have sparse data for short scenes.
      } else {
        console.log(`✅ [${invocationId}] VERIFICATION PASSED: Scene ${sceneNumber} format and content OK`)
      }
    } catch (parseErr) {
      console.error(`❌ [${invocationId}] VERIFICATION FAILED: Scene ${sceneNumber} analysis is not valid JSON`)
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
    console.error(`❌ [${invocationId}] Update error:`, error)
    return res.status(500).json({
      error: 'Failed to update',
      details: error instanceof Error ? error.message : 'Unknown error',
      deployMarker: DEPLOY_TIMESTAMP
    })
  }
}