// api/projects/get-all.ts
// PRODUCTION-READY: Fetches all saved projects filtered by userId

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'
import { logger } from "../lib/logger";

const DEPLOY_TIMESTAMP = '2024-12-24T_USER_FILTER'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()

  // Get userId from query params
  const userId = req.query.userId as string | undefined

  logger.log("get-all", `\n📁 [${invocationId}] ═══════════════════════════════`)
  logger.log("get-all", `📅 Timestamp: ${new Date().toISOString()}`)
  logger.log("get-all", `🏷️  Deploy: ${DEPLOY_TIMESTAMP}`)
  logger.log("get-all", `📍 Method: ${req.method}`)
  logger.log("get-all", `👤 UserId: ${userId || 'none (showing all)'}`)

  // CORS handled by server.mjs middleware

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const db = await Promise.race([
      getDb(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database connection timeout')), 15000)
      )
    ])

    const collection = db.collection('projects')

    // Build query - filter by userId if provided
    const query = userId ? { userId } : {}
    logger.log("get-all", `🔍 [${invocationId}] Query filter:`, query)

    const projectList = await collection
      .find(query)
      .project({ name: 1, updatedAt: 1, userId: 1 })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray()

    logger.log("get-all", `📦 [${invocationId}] Found ${projectList.length} project(s)`)

    const projects = projectList.map((project, index) => {
      const idString = project._id instanceof ObjectId
        ? project._id.toHexString()
        : String(project._id)
      
      logger.log("get-all", `   [${index}] "${project.name}" (user: ${project.userId || 'legacy'})`)
      
      return {
        _id: idString,
        name: project.name || 'Untitled Project',
        updatedAt: project.updatedAt
          ? project.updatedAt instanceof Date
            ? project.updatedAt.toISOString()
            : new Date(project.updatedAt).toISOString()
          : new Date().toISOString()
      }
    })

    const totalDuration = Date.now() - startTime
    logger.log("get-all", `✅ [${invocationId}] SUCCESS in ${totalDuration}ms`)

    return res.status(200).json({
      success: true,
      projects,
      meta: {
        count: projects.length,
        processingTime: totalDuration,
        userId: userId || null
      }
    })
  } catch (error) {
    const totalDuration = Date.now() - startTime
    logger.error("get-all", `❌ [${invocationId}] Error:`, error)

    return res.status(500).json({
      error: 'Failed to fetch projects',
      details: error instanceof Error ? error.message : 'Unknown error',
      processingTime: totalDuration
    })
  }
}
