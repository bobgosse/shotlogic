// api/projects/save-scene.ts
// Saves scene analysis updates to MongoDB

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { projectId, sceneUpdates } = req.body

    if (!projectId || !sceneUpdates) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'projectId and sceneUpdates are required'
      })
    }

    console.log(`📝 Saving ${Object.keys(sceneUpdates).length} scene(s) for project ${projectId}`)

    const db = await getDb()
    const collection = db.collection('projects')

    // Get the current project
    const objectId = new ObjectId(projectId)
    const project = await collection.findOne({ _id: objectId })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Update scenes with new analysis data
    const updatedScenes = (project.scenes || []).map((scene: any) => {
      const sceneKey = `scene-${scene.number}`
      
      if (sceneUpdates[sceneKey]) {
        console.log(`  ✏️ Updating scene ${scene.number}`)
        
        // Merge the new analysis data
        const newAnalysisData = sceneUpdates[sceneKey]
        
        return {
          ...scene,
          analysis: {
            ...scene.analysis,
            data: {
              ...scene.analysis?.data,
              narrativeAnalysis: {
                ...scene.analysis?.data?.narrativeAnalysis,
                stakes: newAnalysisData.story_analysis?.stakes || scene.analysis?.data?.narrativeAnalysis?.stakes,
                centralConflict: newAnalysisData.story_analysis?.ownership || scene.analysis?.data?.narrativeAnalysis?.centralConflict,
                sceneTurn: newAnalysisData.story_analysis?.breaking_point || scene.analysis?.data?.narrativeAnalysis?.sceneTurn,
                synopsis: newAnalysisData.directing_vision?.editorial_intent || scene.analysis?.data?.narrativeAnalysis?.synopsis,
                emotionalTone: newAnalysisData.directing_vision?.visual_metaphor || scene.analysis?.data?.narrativeAnalysis?.emotionalTone,
              },
              shotList: newAnalysisData.shot_list?.map((shot: any) => ({
                shotType: shot.shot_type,
                visualDescription: shot.visual,
                rationale: shot.rationale,
                aiImagePrompt: shot.image_prompt
              })) || scene.analysis?.data?.shotList
            }
          },
          status: 'complete'
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

    console.log(`✅ Updated ${result.modifiedCount} project(s)`)

    return res.status(200).json({
      success: true,
      message: `Updated ${Object.keys(sceneUpdates).length} scene(s)`,
      modifiedCount: result.modifiedCount
    })

  } catch (error) {
    console.error('Save error:', error)
    return res.status(500).json({
      error: 'Failed to save',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
