// api/projects/delete.ts
// Deletes a project from MongoDB

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'

const DEPLOY_TIMESTAMP = '2024-12-13T11:00:00Z_DELETE_ENDPOINT'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()

  console.log(`\n🗑️  [${invocationId}] ═══════════════════════════════`)
  console.log(`📅 Timestamp: ${new Date().toISOString()}`)
  console.log(`🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)
  console.log(`📍 Method: ${req.method}`)

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${invocationId}] CORS preflight handled`)
    return res.status(200).end()
  }

  // Only allow DELETE
  if (req.method !== 'DELETE') {
    console.error(`❌ [${invocationId}] Method not allowed: ${req.method}`)
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'This endpoint only accepts DELETE requests',
      deployMarker: DEPLOY_TIMESTAMP
    })
  }

  try {
    // Extract and validate projectId
    const projectIdParam = req.query.projectId
    
    console.log(`🔍 [${invocationId}] Raw projectId param:`, projectIdParam)
    
    let idString: string
    
    if (!projectIdParam) {
      console.error(`❌ [${invocationId}] No projectId provided`)
      return res.status(400).json({
        error: 'Missing project ID',
        message: 'The projectId query parameter is required',
        deployMarker: DEPLOY_TIMESTAMP
      })
    } else if (Array.isArray(projectIdParam)) {
      idString = projectIdParam[0]
      console.log(`   Extracted from array: ${idString}`)
    } else {
      idString = projectIdParam
      console.log(`   Using single value: ${idString}`)
    }

    if (!idString || idString.trim() === '') {
      console.error(`❌ [${invocationId}] Empty projectId`)
      return res.status(400).json({
        error: 'Invalid project ID',
        message: 'Project ID cannot be empty',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    if (!ObjectId.isValid(idString)) {
      console.error(`❌ [${invocationId}] Invalid ObjectId format: ${idString}`)
      return res.status(400).json({
        error: 'Invalid project ID format',
        message: `"${idString}" is not a valid MongoDB ObjectId`,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const objectId = new ObjectId(idString)
    console.log(`✅ [${invocationId}] Valid ObjectId: ${objectId.toHexString()}`)

    // Connect to database
    console.log(`🔌 [${invocationId}] Connecting to MongoDB...`)
    const db = await getDb()
    const collection = db.collection('projects')
    console.log(`✅ [${invocationId}] Connected to projects collection`)

    // Delete the project
    console.log(`🗑️  [${invocationId}] Attempting to delete project: ${objectId.toHexString()}`)
    const result = await collection.deleteOne({ _id: objectId })

    if (result.deletedCount === 0) {
      console.error(`❌ [${invocationId}] Project not found for deletion`)
      return res.status(404).json({
        error: 'Project not found',
        message: `No project exists with ID: ${idString}`,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const duration = Date.now() - startTime
    console.log(`⏱️  [${invocationId}] Total: ${duration}ms`)
    console.log(`✅ [${invocationId}] SUCCESS - Project deleted`)
    console.log(`═══════════════════════════════════════════════════════\n`)

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
      deletedId: idString,
      processingTime: duration,
      deployMarker: DEPLOY_TIMESTAMP
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
      error: 'Failed to delete project',
      details: error instanceof Error ? error.message : 'Unknown server error',
      deployMarker: DEPLOY_TIMESTAMP,
      processingTime: duration
    })
  }
}