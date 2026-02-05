// api/projects/delete.ts
// Deletes a project from MongoDB with robust validation

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'
import { logger } from "../lib/logger";

const DEPLOY_TIMESTAMP = '2025-12-16T17:45:00Z_FINAL_DELETE_FIX'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()

  logger.log("delete", `\n🗑️  [${invocationId}] ═══════════════════════════════`)
  logger.log("delete", `📅 Timestamp: ${new Date().toISOString()}`)
  logger.log("delete", `🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)
  logger.log("delete", `📍 Method: ${req.method}`)

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'This endpoint only accepts DELETE requests',
      deployMarker: DEPLOY_TIMESTAMP
    })
  }

  try {
    const projectIdParam = req.query.projectId
    
    let idString: string | null = null;
    
    // CRITICAL FIX: Handle cases where projectId might be an array or undefined
    if (Array.isArray(projectIdParam)) {
      idString = projectIdParam[0] || null
    } else if (typeof projectIdParam === 'string') {
      idString = projectIdParam.trim()
    }

    if (!idString) {
      logger.error("delete", `❌ [${invocationId}] Project ID is null or empty after check`)
      return res.status(400).json({
        error: 'Missing or Invalid Project ID',
        message: 'The projectId query parameter is required and cannot be empty.',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }
    
    // Ensure the ID is a valid MongoDB format (24 hex characters)
    if (!ObjectId.isValid(idString)) {
      logger.error("delete", `❌ [${invocationId}] Invalid ObjectId format: ${idString}`)
      return res.status(400).json({
        error: 'Invalid project ID format',
        message: `"${idString}" is not a valid MongoDB ObjectId.`,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const objectId = new ObjectId(idString)
    logger.log("delete", `✅ [${invocationId}] Valid ObjectId: ${objectId.toHexString()}`)

    // Connect to database
    const db = await getDb()
    const collection = db.collection('projects')

    // Delete the project
    const result = await collection.deleteOne({ _id: objectId })

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: 'Project not found',
        message: `No project exists with ID: ${idString}`,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    const duration = Date.now() - startTime
    logger.log("delete", `✅ [${invocationId}] SUCCESS - Project deleted in ${duration}ms`)

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
      deletedId: idString,
      processingTime: duration,
      deployMarker: DEPLOY_TIMESTAMP
    })

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error("delete", `❌ FATAL ERROR: ${error instanceof Error ? error.message : String(error)}`)

    return res.status(500).json({
      error: 'Failed to delete project',
      details: error instanceof Error ? error.message : 'Unknown server error',
      deployMarker: DEPLOY_TIMESTAMP,
      processingTime: duration
    })
  }
}