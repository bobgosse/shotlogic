// api/admin/reassign-projects.ts
// Reassigns all projects from one userId to another (for Clerk environment migration)

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { logger } from "../lib/logger";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const db = await getDb()
    const collection = db.collection('projects')

    // GET: List all projects grouped by userId
    if (req.method === 'GET') {
      const projects = await collection.find({}).project({ name: 1, userId: 1, updatedAt: 1 }).toArray()

      const byUser: Record<string, any[]> = {}
      for (const p of projects) {
        const key = p.userId || 'NO_USER_ID'
        if (!byUser[key]) byUser[key] = []
        byUser[key].push({ id: p._id.toString(), name: p.name || 'Untitled' })
      }

      return res.status(200).json({
        success: true,
        totalProjects: projects.length,
        userIds: Object.keys(byUser),
        projectsByUser: byUser
      })
    }

    // POST: Reassign projects
    if (req.method === 'POST') {
      const { fromUserId, toUserId, reassignAll } = req.body

      if (!toUserId) {
        return res.status(400).json({ error: 'Missing toUserId' })
      }

      let query: any
      if (reassignAll) {
        // Reassign ALL projects to the new user
        query = {}
        logger.log("reassign-projects", `Reassigning ALL projects to ${toUserId}`)
      } else if (fromUserId) {
        // Reassign only from specific user
        query = { userId: fromUserId }
        logger.log("reassign-projects", `Reassigning projects from ${fromUserId} to ${toUserId}`)
      } else {
        // Reassign orphans (no userId)
        query = { $or: [{ userId: { $exists: false } }, { userId: null }] }
        logger.log("reassign-projects", `Reassigning orphan projects to ${toUserId}`)
      }

      const result = await collection.updateMany(query, { $set: { userId: toUserId } })

      return res.status(200).json({
        success: true,
        reassignedCount: result.modifiedCount,
        matchedCount: result.matchedCount,
        message: `Reassigned ${result.modifiedCount} project(s) to ${toUserId}`
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    logger.error("reassign-projects", "Error:", error)
    return res.status(500).json({
      error: 'Failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
