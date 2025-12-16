// api/projects/get-all.ts
// PRODUCTION-READY: Fetches all saved projects
// CRITICAL: Uses .js extension for ES Module compatibility in Vercel

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js' // CRITICAL: .js extension required for Node.js ES Modules
import { ObjectId } from 'mongodb'

const DEPLOY_TIMESTAMP = '2024-12-13T09:00:00Z_MODULE_FIX'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()

  console.log(`\n📁 [${invocationId}] ═══════════════════════════════`)
  console.log(`📅 Timestamp: ${new Date().toISOString()}`)
  console.log(`🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)
  console.log(`📍 Method: ${req.method}`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`)
  console.log(`🔧 Node Version: ${process.version}`)

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${invocationId}] CORS preflight handled`)
    return res.status(200).end()
  }

  // Only accept GET
  if (req.method !== 'GET') {
    console.error(`❌ [${invocationId}] Method not allowed: ${req.method}`)
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'This endpoint only accepts GET requests',
      deployMarker: DEPLOY_TIMESTAMP
    })
  }

  try {
    console.log(`🔌 [${invocationId}] Connecting to MongoDB...`)
    console.log(`   Database: ShotLogicDB`)
    console.log(`   Collection: projects`)

    // Get database connection with timeout
    const db = await Promise.race([
      getDb(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database connection timeout')), 15000)
      )
    ])

    console.log(`✅ [${invocationId}] Successfully connected to database`)
    console.log(`📊 [${invocationId}] Accessing 'projects' collection...`)

    const collection = db.collection('projects')

    // Verify collection is accessible
    try {
      const count = await collection.estimatedDocumentCount()
      console.log(`✅ [${invocationId}] Collection verified: ${count} document(s) total`)
    } catch (collError) {
      console.error(`❌ [${invocationId}] Collection access error:`, collError)
      throw new Error('Projects collection not accessible')
    }

    console.log(`🔍 [${invocationId}] Executing query...`)

    // Fetch projects with proper error handling
    const projectList = await collection
      .find({})
      .project({ name: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray()

    console.log(`📦 [${invocationId}] Query successful: ${projectList.length} project(s) found`)

    // Transform results
    const projects = projectList.map((project) => {
      try {
        return {
          id:
            project._id instanceof ObjectId
              ? project._id.toHexString()
              : String(project._id),
          name: project.name || 'Untitled Project',
          updatedAt: project.updatedAt
            ? project.updatedAt instanceof Date
              ? project.updatedAt.toISOString()
              : new Date(project.updatedAt).toISOString()
            : new Date().toISOString()
        }
      } catch (transformError) {
        console.error(`⚠️  [${invocationId}] Error transforming project:`, transformError)
        return {
          id: String(project._id),
          name: project.name || 'Untitled Project',
          updatedAt: new Date().toISOString()
        }
      }
    })

    const totalDuration = Date.now() - startTime
    console.log(`⏱️  [${invocationId}] Processing complete: ${totalDuration}ms`)
    console.log(`✅ [${invocationId}] SUCCESS`)
    console.log(`🔄 [${invocationId}] Connection kept alive for reuse`)
    console.log(`═══════════════════════════════════════════════════════\n`)

    return res.status(200).json({
      success: true,
      projects,
      meta: {
        count: projects.length,
        processingTime: totalDuration,
        deployMarker: DEPLOY_TIMESTAMP
      }
    })
  } catch (error) {
    const totalDuration = Date.now() - startTime
    console.error(`\n💥 [${invocationId}] ═══════════════════════════════`)
    console.error(`❌ FATAL ERROR after ${totalDuration}ms`)
    console.error(`📛 Error Type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`)
    console.error(`📛 Error Message: ${error instanceof Error ? error.message : String(error)}`)

    if (error instanceof Error && error.stack) {
      console.error(`📛 Stack Trace:`)
      console.error(error.stack)
    }

    console.error(`═══════════════════════════════════════════════════════\n`)

    // Determine error type and appropriate response
    let statusCode = 500
    let errorMessage = 'Failed to fetch projects'
    let errorDetails = error instanceof Error ? error.message : 'Unknown error'

    if (errorDetails.includes('timeout')) {
      statusCode = 504
      errorMessage = 'Database connection timeout'
      errorDetails = 'The database took too long to respond. Please try again.'
    } else if (errorDetails.includes('authentication') || errorDetails.includes('auth')) {
      statusCode = 500
      errorMessage = 'Database authentication failed'
      errorDetails = 'Check your MongoDB URI and credentials in Vercel environment variables.'
    } else if (errorDetails.includes('not accessible')) {
      statusCode = 500
      errorMessage = 'Collection not found'
      errorDetails = 'The projects collection does not exist in ShotLogicDB. Create it in MongoDB Atlas.'
    } else if (errorDetails.includes('ENOTFOUND') || errorDetails.includes('network')) {
      statusCode = 503
      errorMessage = 'Database unreachable'
      errorDetails = 'Cannot reach MongoDB Atlas. Check network access settings and cluster status.'
    }

    return res.status(statusCode).json({
      error: errorMessage,
      details: errorDetails,
      deployMarker: DEPLOY_TIMESTAMP,
      processingTime: totalDuration
    })
  }
  // CRITICAL: NO finally block - connection must stay alive for reuse
}