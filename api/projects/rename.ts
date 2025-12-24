// api/projects/rename.ts
// Renames a project in MongoDB
import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'

const DEPLOY_TIMESTAMP = '2025-12-24T20:00:00Z_RENAME_ENDPOINT'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()
  
  console.log(`\n✏️  [${invocationId}] ═══════════════════════════════`)
  console.log(`📅 Timestamp: ${new Date().toISOString()}`)
  console.log(`🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)
  console.log(`📍 Method: ${req.method}`)

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'This endpoint only accepts PATCH or POST requests',
      deployMarker: DEPLOY_TIMESTAMP
    })
  }

  try {
    const { projectId, newName } = req.body || {}

    console.log(`📝 [${invocationId}] Rename request:`, { projectId, newName })

    // Validate projectId
    if (!projectId || typeof projectId !== 'string') {
      console.error(`❌ [${invocationId}] Project ID is missing or invalid`)
      return res.status(400).json({
        error: 'Missing Project ID',
        message: 'The projectId field is required.',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Validate newName
    if (!newName || typeof newName !== 'string') {
      console.error(`❌ [${invocationId}] New name is missing or invalid`)
      return res.status(400).json({
        error: 'Missing New Name',
        message: 'The newName field is required.',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const trimmedName = newName.trim()

    if (trimmedName.length === 0) {
      return res.status(400).json({
        error: 'Invalid Name',
        message: 'Project name cannot be empty.',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    if (trimmedName.length > 100) {
      return res.status(400).json({
        error: 'Invalid Name',
        message: 'Project name must be under 100 characters.',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(projectId)) {
      console.error(`❌ [${invocationId}] Invalid ObjectId format: ${projectId}`)
      return res.status(400).json({
        error: 'Invalid project ID format',
        message: `"${projectId}" is not a valid MongoDB ObjectId.`,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const objectId = new ObjectId(projectId)
    console.log(`✅ [${invocationId}] Valid ObjectId: ${objectId.toHexString()}`)

    // Connect to database
    const db = await getDb()
    const collection = db.collection('projects')

    // Update the project name
    const result = await collection.updateOne(
      { _id: objectId },
      { 
        $set: { 
          name: trimmedName,
          updatedAt: new Date().toISOString()
        } 
      }
    )

    if (result.matchedCount === 0) {
      return res.status(404).json({
        error: 'Project not found',
        message: `No project exists with ID: ${projectId}`,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const duration = Date.now() - startTime
    console.log(`✅ [${invocationId}] SUCCESS - Project renamed to "${trimmedName}" in ${duration}ms`)

    return res.status(200).json({
      success: true,
      message: 'Project renamed successfully',
      newName: trimmedName,
      projectId: projectId,
      processingTime: duration,
      deployMarker: DEPLOY_TIMESTAMP
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`❌ FATAL ERROR: ${error instanceof Error ? error.message : String(error)}`)
    
    return res.status(500).json({
      error: 'Failed to rename project',
      details: error instanceof Error ? error.message : 'Unknown server error',
      deployMarker: DEPLOY_TIMESTAMP,
      processingTime: duration
    })
  }
}