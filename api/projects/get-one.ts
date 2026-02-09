// api/projects/get-one.ts
// PRODUCTION-READY: Retrieves a single saved project from MongoDB
// FIXED: Handles both old nested format and new stringified format

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'
import { logger } from "../lib/logger";

const DEPLOY_TIMESTAMP = '2025-02-05T02:00:00Z_PRESERVE_ALL_SHOT_FIELDS'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  const startTime = Date.now()

  logger.log("get-one", `\n📂 [${invocationId}] ═══════════════════════════════`)
  logger.log("get-one", `📅 Timestamp: ${new Date().toISOString()}`)
  logger.log("get-one", `🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed', deployMarker: DEPLOY_TIMESTAMP })
  }

  try {
    const projectIdParam = req.query.projectId
    
    let idString: string
    
    if (!projectIdParam) {
      return res.status(400).json({ error: 'Missing project ID', deployMarker: DEPLOY_TIMESTAMP })
    } else if (Array.isArray(projectIdParam)) {
      idString = projectIdParam[0]
    } else {
      idString = projectIdParam
    }

    if (!idString || idString.trim() === '') {
      return res.status(400).json({ error: 'Invalid project ID', deployMarker: DEPLOY_TIMESTAMP })
    }

    if (!ObjectId.isValid(idString)) {
      return res.status(400).json({ error: 'Invalid project ID format', deployMarker: DEPLOY_TIMESTAMP })
    }

    const objectId = new ObjectId(idString)
    logger.log("get-one", `✅ [${invocationId}] Looking up project: ${objectId.toHexString()}`)

    const db = await getDb()
    const collection = db.collection('projects')
    const project = await collection.findOne({ _id: objectId })

    if (!project) {
      return res.status(404).json({ error: 'Project not found', deployMarker: DEPLOY_TIMESTAMP })
    }

    logger.log("get-one", `✅ [${invocationId}] Project found: ${project.name || 'Untitled'}`)

    // Transform scenes to match frontend expectations
    const transformedScenes = (project.scenes || []).map((scene: any, index: number) => {
      const textLines = (scene.text || '').split('\n');
      const header = textLines[0] || `Scene ${scene.number || index + 1}`;

      // ═══════════════════════════════════════════════════════════════
      // DEFENSIVE FORMAT GUARD - Convert old format to new on-the-fly
      // This prevents any old-format data from breaking the frontend
      // ═══════════════════════════════════════════════════════════════
      if (scene.analysis && typeof scene.analysis === 'object' && !Array.isArray(scene.analysis)) {
        logger.warn("get-one", `⚠️ [${invocationId}] FORMAT GUARD: Scene ${scene.number || 'unknown'} has object analysis, converting to string`)

        // Check if it's the old nested format
        if (scene.analysis.data) {
          logger.warn("get-one", `   [${invocationId}] Detected old nested format (analysis.data), extracting...`)
          // Try to extract what we can from old format
          const oldData = scene.analysis.data
          const converted = {
            story_analysis: {
              the_core: oldData.narrativeAnalysis?.stakes || '',
              synopsis: oldData.narrativeAnalysis?.synopsis || '',
              the_turn: oldData.narrativeAnalysis?.sceneTurn || '',
              ownership: oldData.narrativeAnalysis?.centralConflict || '',
              the_times: '',
              imagery_and_tone: oldData.narrativeAnalysis?.emotionalTone || '',
              stakes: oldData.narrativeAnalysis?.stakes || '',
              pitfalls: []
            },
            producing_logistics: {
              locations: oldData.producingAnalysis?.locations || {},
              cast: oldData.producingAnalysis?.cast || {},
              key_props: oldData.producingAnalysis?.keyProps || [],
              red_flags: oldData.producingAnalysis?.budgetFlags || [],
              departments_affected: [],
              resource_impact: 'Unknown'
            },
            directing_vision: {
              subtext: null,
              conflict: oldData.directingAnalysis?.conflict || null,
              tone_and_mood: oldData.directingAnalysis?.toneAndMood || null,
              visual_strategy: oldData.directingAnalysis?.visualStrategy || null,
              visual_metaphor: oldData.directingAnalysis?.visualStrategy?.approach || '',
              key_moments: [],
              blocking: oldData.directingAnalysis?.blockingIdeas || null
            },
            shot_list: (oldData.shotList || []).map((s: any, idx: number) => ({
              shot_number: s.shotNumber || idx + 1,
              shot_type: s.shotType || 'WIDE',
              movement: s.movement || 'STATIC',
              subject: s.visualDescription || '',
              visual: s.visualDescription || '',
              rationale: s.rationale || '',
              serves_story_element: 'CORE'
            }))
          }
          scene.analysis = JSON.stringify(converted)
          logger.log("get-one", `   [${invocationId}] Converted old format to string (${converted.shot_list.length} shots)`)
        } else {
          // It's an object but not the old nested format - just stringify it
          logger.warn("get-one", `   [${invocationId}] Object format without .data, stringifying directly`)
          scene.analysis = JSON.stringify(scene.analysis)
        }
      }

      // CRITICAL FIX: Handle multiple analysis formats
      let analysisString: string | null = null;

      if (scene.analysis) {
        // Case 1: Analysis is already a string (new format from Index.tsx)
        if (typeof scene.analysis === 'string') {
          logger.log("get-one", `   Scene ${scene.number}: Analysis is string (new format)`)
          // Parse, transform shot_list if needed, re-stringify
          try {
            const parsed = JSON.parse(scene.analysis);
            // Transform camelCase shot_list to snake_case if needed, PRESERVING all original fields
            if (parsed.shot_list && Array.isArray(parsed.shot_list)) {
              parsed.shot_list = parsed.shot_list.map((shot: any, idx: number) => ({
                // Spread original shot first to preserve ALL fields (serves_story_element, editorial_note, etc.)
                ...shot,
                // Then normalize specific fields that may have legacy names
                shot_number: shot.shot_number || shot.shotNumber || idx + 1,
                shot_type: shot.shot_type || shot.shotType || 'WIDE',
                movement: shot.movement || 'STATIC',
                subject: shot.subject || '',
                action: shot.action || '',
                visual: shot.visual || shot.visualDescription || '',
                rationale: shot.rationale || '',
                image_prompt: shot.image_prompt || shot.aiImagePrompt || ''
              }));
            }
            analysisString = JSON.stringify(parsed);
          } catch {
            // If parse fails, use as-is
            analysisString = scene.analysis;
          }
        }
        // Case 2: Analysis is object with data property (old format)
        else if (scene.analysis.data) {
          logger.log("get-one", `   Scene ${scene.number}: Analysis has data property (old format)`)
          const data = scene.analysis.data;
          
          // Transform old format to new format
          const transformedAnalysis = {
            story_analysis: {
              synopsis: data.narrativeAnalysis?.synopsis || data.story_analysis?.synopsis || '',
              stakes: data.narrativeAnalysis?.stakes || data.story_analysis?.stakes || '',
              ownership: data.narrativeAnalysis?.centralConflict || data.story_analysis?.ownership || '',
              breaking_point: data.narrativeAnalysis?.sceneTurn || data.story_analysis?.breaking_point || '',
              key_props: Array.isArray(data.producingAnalysis?.keyProps) 
                ? data.producingAnalysis.keyProps.join(', ') 
                : (data.story_analysis?.key_props || '')
            },
            producing_logistics: {
              resource_impact: data.producing_logistics?.resource_impact || 'Low',
              red_flags: data.producingAnalysis?.budgetFlags || data.producing_logistics?.red_flags || [],
              departments_affected: data.producing_logistics?.departments_affected || [],
              locations: data.producingAnalysis?.locations || data.producing_logistics?.locations || {},
              cast: data.producingAnalysis?.cast || data.producing_logistics?.cast || {},
              key_props: data.producingAnalysis?.keyProps || data.producing_logistics?.key_props || [],
              vehicles: data.producingAnalysis?.vehicles || data.producing_logistics?.vehicles || [],
              sfx: data.producingAnalysis?.sfx || data.producing_logistics?.sfx || {},
              wardrobe: data.producingAnalysis?.wardrobe || data.producing_logistics?.wardrobe || {},
              makeup: data.producingAnalysis?.makeup || data.producing_logistics?.makeup || {},
              scheduling: data.producingAnalysis?.schedulingConcerns || data.producing_logistics?.scheduling || {}
            },
            directing_vision: {
              visual_metaphor: data.directingAnalysis?.visualStrategy?.approach || data.directing_vision?.visual_metaphor || '',
              editorial_intent: data.directing_vision?.editorial_intent || '',
              shot_motivation: data.directingAnalysis?.conflict?.description || data.directing_vision?.shot_motivation || '',
              conflict: data.directingAnalysis?.conflict || data.directing_vision?.conflict || {},
              tone_and_mood: data.directingAnalysis?.toneAndMood || data.directing_vision?.tone_and_mood || {},
              blocking: data.directingAnalysis?.blockingIdeas || data.directing_vision?.blocking || {},
              performance_notes: data.directingAnalysis?.performanceNotes?.specific || data.directing_vision?.performance_notes || []
            },
            shot_list: (data.shotList || data.shot_list || []).map((shot: any, idx: number) => ({
              shotNumber: shot.shotNumber || shot.shot_number || idx + 1,
              shotType: shot.shotType || shot.shot_type || 'WIDE',
              movement: shot.movement || 'STATIC',
              subject: shot.subject || '',
              action: shot.action || '',
              visualDescription: shot.visualDescription || shot.visual || '',
              rationale: shot.rationale || '',
              aiImagePrompt: shot.aiImagePrompt || shot.image_prompt || ''
            }))
          };
          
          analysisString = JSON.stringify(transformedAnalysis);
        }
        // Case 3: Analysis is already in correct object format (direct from API)
        else if (scene.analysis.story_analysis || scene.analysis.producing_logistics) {
          logger.log("get-one", `   Scene ${scene.number}: Analysis is object (correct format)`)
          analysisString = JSON.stringify(scene.analysis);
        }
      }

      return {
        id: `scene-${scene.number || index + 1}`,
        scene_number: scene.number || index + 1,
        header: header,
        content: scene.text || '',
        analysis: analysisString,
        status: scene.status === 'complete' || scene.status === 'COMPLETED' ? 'COMPLETED' : (scene.status || 'PENDING').toUpperCase()
      };
    });

    const duration = Date.now() - startTime
    logger.log("get-one", `⏱️  [${invocationId}] Total: ${duration}ms`)

    // Determine project status from scene statuses
    const completedCount = transformedScenes.filter((s: any) => s.status === 'COMPLETED').length
    const errorCount = transformedScenes.filter((s: any) => s.status === 'ERROR').length
    const analyzingCount = transformedScenes.filter((s: any) => s.status === 'ANALYZING').length
    const pendingCount = transformedScenes.filter((s: any) => s.status === 'PENDING').length
    const allDone = completedCount + errorCount === transformedScenes.length && analyzingCount === 0 && pendingCount === 0

    // Use stored project status if still processing, otherwise derive from scenes
    const projectStatus = allDone
      ? 'COMPLETED'
      : (project.status === 'processing' ? 'processing' : (analyzingCount > 0 || pendingCount > 0 ? 'processing' : 'COMPLETED'))

    return res.status(200).json({
      success: true,
      project: {
        _id: project._id.toHexString(),
        id: project._id.toHexString(),
        title: project.name || 'Untitled Project',
        name: project.name || 'Untitled Project',
        scenes: transformedScenes,
        total_scenes: transformedScenes.length,
        current_scene: completedCount,
        status: projectStatus,
        visual_style: project.visual_style || null,
        characters: project.characters || [],
        visual_profile: project.visual_profile || null,
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
    logger.error("get-one", `❌ [${invocationId}] Error after ${duration}ms:`, error)

    return res.status(500).json({
      error: 'Failed to retrieve project',
      details: error instanceof Error ? error.message : 'Unknown error',
      deployMarker: DEPLOY_TIMESTAMP
    })
  }
}