// api/admin/clear-all-projects.ts
// ADMIN ONLY: Deletes all projects from database
// Access with: POST /api/admin/clear-all-projects (with X-API-Key header)

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { logger } from "../lib/logger";

const ADMIN_SECRET = process.env.ADMIN_API_KEY || process.env.ADMIN_SECRET || 'change-me-in-production'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS handled by server.mjs middleware

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // Check admin secret (header only - never use query params for secrets)
  const secret = req.headers['x-api-key'] as string
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden: Invalid or missing X-API-Key header' })
  }

  try {
    const db = await getDb()
    const collection = db.collection('projects')

    // Get count before deletion
    const countBefore = await collection.countDocuments()
    logger.log("clear-all-projects", `📊 Found ${countBefore} projects`)

    if (countBefore === 0) {
      return res.status(200).json({
        success: true,
        message: 'Database is already empty',
        deleted: 0
      })
    }

    // Delete all projects
    const result = await collection.deleteMany({})
    logger.log("clear-all-projects", `✅ Deleted ${result.deletedCount} projects`)

    return res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} projects`,
      deleted: result.deletedCount
    })

  } catch (error) {
    logger.error("clear-all-projects", '❌ Error clearing projects:', error)
    return res.status(500).json({
      error: 'Failed to clear projects',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
