// api/projects/get-one.ts
// PRODUCTION-READY: Retrieves a single saved project from MongoDB
// FIXED: Handles both old nested format and new stringified format

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'

const DEPLOY_TIMESTAMP = '2024-12-24T23:59:00Z_STRING_FORMAT_FIX'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()

  console.log(`\n📂 [${invocationId}] ═══════════════════════════════`)
  console.log(`📅 Timestamp: ${new Date().toISOString()}`)
  console.log(`🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)

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
    console.log(`✅ [${invocationId}] Looking up project: ${objectId.toHexString()}`)

    const db = await getDb()
    const collection = db.collection('projects')
    const project = await collection.findOne({ _id: objectId })

    if (!project) {
      return res.status(404).json({ error: 'Project not found', deployMarker: DEPLOY_TIMESTAMP })
    }

    console.log(`✅ [${invocationId}] Project found: ${project.name || 'Untitled'}`)

    // Transform scenes to match frontend expectations
    const transformedScenes = (project.scenes || []).map((scene: any, index: number) => {
      const textLines = (scene.text || '').split('\n');
      const header = textLines[0] || `Scene ${scene.number || index + 1}`;
      
      // CRITICAL FIX: Handle multiple analysis formats
      let analysisString: string | null = null;
      
      if (scene.analysis) {
        // Case 1: Analysis is already a string (new format from Index.tsx)
        if (typeof scene.analysis === 'string') {
          console.log(`   Scene ${scene.number}: Analysis is string (new format)`)
          analysisString = scene.analysis;
        }
        // Case 2: Analysis is object with data property (old format)
        else if (scene.analysis.data) {
          console.log(`   Scene ${scene.number}: Analysis has data property (old format)`)
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
          console.log(`   Scene ${scene.number}: Analysis is object (correct format)`)
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
    console.log(`⏱️  [${invocationId}] Total: ${duration}ms`)

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
    console.error(`❌ [${invocationId}] Error after ${duration}ms:`, error)

    return res.status(500).json({
      error: 'Failed to retrieve project',
      details: error instanceof Error ? error.message : 'Unknown error',
      deployMarker: DEPLOY_TIMESTAMP
    })
  }
}