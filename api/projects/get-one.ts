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
    if (!project.projectData) {
      console.error(`❌ [${invocationId}] Project has no projectData field`)
      return res.status(500).json({
        error: 'Invalid project structure',
        message: 'Project exists but has no data',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const duration = Date.now() - startTime
    console.log(`⏱️  [${invocationId}] Total: ${duration}ms`)
    console.log(`✅ [${invocationId}] SUCCESS`)
    console.log(`═══════════════════════════════════════════════════════\n`)

    // CRITICAL: Return structure that matches frontend expectations
    return res.status(200).json({
      success: true,
      projectId: project._id.toHexString(),
      projectName: project.name || 'Untitled Project',
      projectData: project.projectData,
      meta: {
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
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