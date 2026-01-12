// api/admin/clear-all-projects.ts
// ADMIN ONLY: Deletes all projects from database
// Access with: POST /api/admin/clear-all-projects?secret=YOUR_SECRET

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-me-in-production'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // Check admin secret
  const secret = req.query.secret || req.body?.secret
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden: Invalid admin secret' })
  }

  try {
    const db = await getDb()
    const collection = db.collection('projects')

    // Get count before deletion
    const countBefore = await collection.countDocuments()
    console.log(`📊 Found ${countBefore} projects`)

    if (countBefore === 0) {
      return res.status(200).json({
        success: true,
        message: 'Database is already empty',
        deleted: 0
      })
    }

    // Delete all projects
    const result = await collection.deleteMany({})
    console.log(`✅ Deleted ${result.deletedCount} projects`)

    return res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} projects`,
      deleted: result.deletedCount
    })

  } catch (error) {
    console.error('❌ Error clearing projects:', error)
    return res.status(500).json({
      error: 'Failed to clear projects',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
