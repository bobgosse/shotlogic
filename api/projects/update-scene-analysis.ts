// api/projects/update-scene-analysis.ts
// Updates a single scene's analysis in MongoDB

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { projectId, sceneNumber, analysis } = req.body

    if (!projectId || !sceneNumber || !analysis) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'projectId, sceneNumber, and analysis are required'
      })
    }

    console.log(`📝 Updating analysis for project ${projectId}, scene ${sceneNumber}`)

    const db = await getDb()
    const collection = db.collection('projects')

    const objectId = new ObjectId(projectId)
    const project = await collection.findOne({ _id: objectId })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Extract the actual analysis data (handle nested structure)
    let analysisData = analysis
    if (analysis.data) {
      analysisData = analysis.data
    }

    console.log(`   Analysis data keys: ${Object.keys(analysisData).join(', ')}`)

    // Update the specific scene's analysis
    let matchFound = false
    const updatedScenes = (project.scenes || []).map((scene: any, index: number) => {
      const sceneNum = scene.number || scene.scene_number || (index + 1)
      const targetNum = Number(sceneNumber)
      
      if (Number(sceneNum) === targetNum) {
        matchFound = true
        console.log(`   ✅ Updating scene ${sceneNum}`)
        return {
          ...scene,
          analysis: {
            data: analysisData,
            meta: {
              sceneNumber: targetNum,
              updatedAt: new Date().toISOString()
            }
          },
          status: 'complete'
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

    console.log(`✅ Scene ${sceneNumber} analysis saved`)

    return res.status(200).json({
      success: true,
      message: `Scene ${sceneNumber} analysis updated`
    })

  } catch (error) {
    console.error('Update error:', error)
    return res.status(500).json({
      error: 'Failed to update',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
