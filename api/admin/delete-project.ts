// api/admin/delete-project.ts
// Admin endpoint to delete a project by ID
// Usage: DELETE /api/admin/delete-project?id=xxx&key=YOUR_API_KEY

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key')

  if (req.method === 'OPTIONS') return res.status(200).end()
  // Accept both GET (for browser testing) and DELETE (proper usage)
  if (req.method !== 'DELETE' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // API key authentication
  const apiKey = req.headers['x-api-key'] || req.query.key
  const expectedKey = process.env.ADMIN_API_KEY

  if (!expectedKey) {
    return res.status(503).json({
      error: 'Admin endpoint not configured',
      message: 'ADMIN_API_KEY environment variable is not set'
    })
  }

  if (apiKey !== expectedKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key'
    })
  }

  // Get project ID(s) to delete
  const idParam = req.query.id
  if (!idParam) {
    return res.status(400).json({
      error: 'Missing id parameter',
      message: 'Provide ?id=xxx or ?id=xxx,yyy,zzz for multiple'
    })
  }

  // Support comma-separated IDs
  const ids = (Array.isArray(idParam) ? idParam[0] : idParam).split(',').map(s => s.trim())

  try {
    const db = await getDb()
    const collection = db.collection('projects')

    const results: any[] = []

    for (const id of ids) {
      try {
        const objectId = new ObjectId(id)

        // Find the project first
        const project = await collection.findOne({ _id: objectId })

        if (!project) {
          results.push({ id, status: 'not_found' })
          continue
        }

        // Delete it
        await collection.deleteOne({ _id: objectId })
        results.push({
          id,
          status: 'deleted',
          name: project.name || 'Untitled',
          sceneCount: project.scenes?.length || 0
        })

      } catch (e) {
        results.push({ id, status: 'invalid_id' })
      }
    }

    const deletedCount = results.filter(r => r.status === 'deleted').length

    return res.status(200).json({
      success: true,
      deletedCount,
      results
    })

  } catch (error) {
    console.error('Delete error:', error)
    return res.status(500).json({
      error: 'Failed to delete',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
