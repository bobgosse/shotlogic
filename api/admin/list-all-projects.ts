// api/admin/list-all-projects.ts
// Lists all projects with their user IDs for debugging ownership issues

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { logger } from "../lib/logger";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  logger.log("list-all-projects", "Admin endpoint called");

  // CORS handled by server.mjs middleware
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const db = await getDb()
    const collection = db.collection('projects')

    // Get all projects with just the fields we need
    const projects = await collection
      .find({})
      .project({
        name: 1,
        userId: 1,
        createdAt: 1,
        updatedAt: 1,
        'scenes': { $size: '$scenes' } // This won't work, we'll count separately
      })
      .sort({ updatedAt: -1 })
      .toArray()

    // Get scene counts separately
    const projectsWithCounts = await Promise.all(projects.map(async (p) => {
      const fullProject = await collection.findOne({ _id: p._id }, { projection: { scenes: 1 } })
      return {
        id: p._id.toHexString(),
        name: p.name || 'Untitled',
        userId: p.userId || 'NO_USER_ID (orphan)',
        sceneCount: fullProject?.scenes?.length || 0,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }
    }))

    // Group by userId
    const byUser: Record<string, typeof projectsWithCounts> = {}
    for (const p of projectsWithCounts) {
      const key = p.userId
      if (!byUser[key]) byUser[key] = []
      byUser[key].push(p)
    }

    return res.status(200).json({
      success: true,
      totalProjects: projectsWithCounts.length,
      projectsByUser: byUser,
      allProjects: projectsWithCounts,
      note: "userId is the Clerk user ID. To find emails, check your Clerk dashboard Users section."
    })

  } catch (error) {
    logger.error("list-all-projects", "Error:", error)
    return res.status(500).json({
      error: 'Failed to list projects',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
