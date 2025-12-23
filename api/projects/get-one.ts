// api/projects/get-one.ts
// PRODUCTION-READY: Retrieves a single saved project from MongoDB
// CRITICAL FIX: Handles query parameter as string OR array

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js' // FIXED: Correct relative path with .js extension
import { ObjectId } from 'mongodb'

const DEPLOY_TIMESTAMP = '2024-12-13T10:00:00Z_ARRAY_HANDLING_FIX'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()

  console.log(`\n📂 [${invocationId}] ═══════════════════════════════`)
  console.log(`📅 Timestamp: ${new Date().toISOString()}`)
  console.log(`🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)
  console.log(`📍 Method: ${req.method}`)

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${invocationId}] CORS preflight handled`)
    return res.status(200).end()
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    console.error(`❌ [${invocationId}] Method not allowed: ${req.method}`)
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'This endpoint only accepts GET requests',
      deployMarker: DEPLOY_TIMESTAMP
    })
  }

  try {
    // CRITICAL FIX: Handle projectId as string OR array
    const projectIdParam = req.query.projectId
    
    console.log(`🔍 [${invocationId}] Raw projectId param:`, projectIdParam)
    console.log(`   Type: ${typeof projectIdParam}`)
    console.log(`   Is Array: ${Array.isArray(projectIdParam)}`)
    
    // Extract string from array if necessary
    let idString: string
    
    if (!projectIdParam) {
      console.error(`❌ [${invocationId}] No projectId provided`)
      return res.status(400).json({
        error: 'Missing project ID',
        message: 'The projectId query parameter is required',
        deployMarker: DEPLOY_TIMESTAMP
      })
    } else if (Array.isArray(projectIdParam)) {
      // FIXED: Extract first element from array
      idString = projectIdParam[0]
      console.log(`   Extracted from array: ${idString}`)
    } else {
      // Single string value
      idString = projectIdParam
      console.log(`   Using single value: ${idString}`)
    }

    // Validate it's not empty
    if (!idString || idString.trim() === '') {
      console.error(`❌ [${invocationId}] Empty projectId`)
      return res.status(400).json({
        error: 'Invalid project ID',
        message: 'Project ID cannot be empty',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(idString)) {
      console.error(`❌ [${invocationId}] Invalid ObjectId format: ${idString}`)
      return res.status(400).json({
        error: 'Invalid project ID format',
        message: `"${idString}" is not a valid MongoDB ObjectId`,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const objectId = new ObjectId(idString)
    console.log(`✅ [${invocationId}] Valid ObjectId created: ${objectId.toHexString()}`)

    // Connect to database
    console.log(`🔌 [${invocationId}] Connecting to MongoDB...`)
    const db = await getDb()
    const collection = db.collection('projects')
    console.log(`✅ [${invocationId}] Connected to projects collection`)

    // Find the project
    console.log(`🔍 [${invocationId}] Searching for project with ID: ${objectId.toHexString()}`)
    const project = await collection.findOne({ _id: objectId })

    if (!project) {
      console.error(`❌ [${invocationId}] Project not found: ${idString}`)
      return res.status(404).json({
        error: 'Project not found',
        message: `No project exists with ID: ${idString}`,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    console.log(`✅ [${invocationId}] Project found: ${project.name || 'Untitled'}`)

    // Validate project structure
   const duration = Date.now() - startTime
    console.log(`⏱️  [${invocationId}] Total: ${duration}ms`)
    console.log(`✅ [${invocationId}] SUCCESS`)
    console.log(`═══════════════════════════════════════════════════════\n`)

    // Return the full project - data is stored directly on project, not in projectData
  // Transform scenes to match frontend expectations
    const transformedScenes = (project.scenes || []).map((scene: any, index: number) => {
      // Extract header from text (first line or scene heading)
      const textLines = (scene.text || '').split('\n');
      const header = textLines[0] || `Scene ${scene.number || index + 1}`;
      
      // Transform analysis data to match expected structure
      let analysisData = null;
      if (scene.analysis?.data) {
        const data = scene.analysis.data;
        analysisData = {
          story_analysis: {
            stakes: data.narrativeAnalysis?.stakes || '',
            ownership: data.narrativeAnalysis?.centralConflict || '',
            breaking_point: data.narrativeAnalysis?.sceneTurn || '',
            key_props: (data.producingAnalysis?.keyProps || []).join(', '),
            subtext: data.narrativeAnalysis?.subtext || '',
            synopsis: data.narrativeAnalysis?.synopsis || ''
          },
          producing_logistics: {
            // Locations
            locations: data.producingAnalysis?.locations || {},
            // Cast
            cast: data.producingAnalysis?.cast || {},
            // Props & Vehicles
            key_props: data.producingAnalysis?.keyProps || [],
            vehicles: data.producingAnalysis?.vehicles || [],
            // SFX
            sfx: data.producingAnalysis?.sfx || {},
            // Wardrobe & Makeup
            wardrobe: data.producingAnalysis?.wardrobe || {},
            makeup: data.producingAnalysis?.makeup || {},
            // Scheduling & Budget
            scheduling_concerns: data.producingAnalysis?.schedulingConcerns || {},
            budget_flags: data.producingAnalysis?.budgetFlags || [],
            // Legacy fields for backwards compatibility
            red_flags: data.producingAnalysis?.budgetFlags || [],
            resource_impact: data.producingAnalysis?.budgetFlags?.length > 2 ? 'High' : (data.producingAnalysis?.budgetFlags?.length > 0 ? 'Medium' : 'Low'),
            departments_affected: Object.keys(data.producingAnalysis?.sfx || {}).filter(k => {
              const val = data.producingAnalysis?.sfx?.[k];
              return Array.isArray(val) ? val.length > 0 : !!val;
            }),
            special_requirements: [
              ...(data.producingAnalysis?.sfx?.practical || []),
              ...(data.producingAnalysis?.sfx?.vfx || []),
              ...(data.producingAnalysis?.sfx?.stunts || [])
            ]
          },
          directing_vision: {
            // Character & Conflict
            character_motivations: data.directingAnalysis?.characterMotivations || [],
            conflict: data.directingAnalysis?.conflict || {},
            subtext: data.directingAnalysis?.subtext || data.narrativeAnalysis?.subtext || '',
            // Tone & Mood
            tone_and_mood: data.directingAnalysis?.toneAndMood || {},
            // Visual Strategy
            visual_strategy: data.directingAnalysis?.visualStrategy || {},
            // Key Moments & Performance
            key_moments: data.directingAnalysis?.keyMoments || [],
            performance_notes: data.directingAnalysis?.performanceNotes || {},
            blocking_ideas: data.directingAnalysis?.blockingIdeas || {},
            // Legacy fields for backwards compatibility
            visual_metaphor: data.directingAnalysis?.toneAndMood?.opening || data.narrativeAnalysis?.emotionalTone || '',
            editorial_intent: data.narrativeAnalysis?.synopsis || '',
            shot_motivation: data.directingAnalysis?.conflict?.description || '',
            visual_approach: data.directingAnalysis?.visualStrategy?.approach || data.directingAnalysis?.visualApproach || ''
          },
          shot_list: (data.shotList || []).map((shot: any, idx: number) => ({
            shot_number: shot.shotNumber || idx + 1,
            shot_type: shot.shotType || 'WIDE',
            movement: shot.movement || 'STATIC',
            subject: shot.subject || '',
            action: shot.action || '',
            visual: shot.visualDescription || '',
            rationale: shot.rationale || '',
            editorial_intent: shot.editorialIntent || '',
            duration: shot.duration || 'MEDIUM',
            image_prompt: shot.aiImagePrompt || ''
          }))
        };
      }

      return {
        id: `scene-${scene.number || index + 1}`,
        scene_number: scene.number || index + 1,
        header: header,
        content: scene.text || '',
        analysis: analysisData ? JSON.stringify(analysisData) : null,
        status: scene.status === 'complete' ? 'COMPLETED' : (scene.status || 'PENDING').toUpperCase()
      };
    });

    // Return the full project with transformed scenes
    return res.status(200).json({
      success: true,
      project: {
        _id: project._id.toHexString(),
        id: project._id.toHexString(),
        title: project.name || 'Untitled Project',
        name: project.name || 'Untitled Project',
        scenes: transformedScenes,
        total_scenes: transformedScenes.length,
        current_scene: transformedScenes.length,
        status: 'COMPLETED',
        visual_style: project.visual_style || null,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      },
      meta: {
        processingTime: duration,
        deployMarker: DEPLOY_TIMESTAMP
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`\n💥 [${invocationId}] ═══════════════════════════════`)
    console.error(`❌ FATAL ERROR after ${duration}ms`)
    console.error(`📛 Type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`)
    console.error(`📛 Message: ${error instanceof Error ? error.message : String(error)}`)
    
    if (error instanceof Error && error.stack) {
      console.error(`📛 Stack:`)
      console.error(error.stack)
    }
    
    console.error(`═══════════════════════════════════════════════════════\n`)

    return res.status(500).json({
      error: 'Failed to retrieve project',
      details: error instanceof Error ? error.message : 'Unknown server error',
      deployMarker: DEPLOY_TIMESTAMP,
      processingTime: duration
    })
  }
}