// api/projects/claim-orphans.ts
// Claims all projects without a userId and assigns them to the requesting user

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' })
  }

  try {
    const db = await getDb()
    const collection = db.collection('projects')

    // Find and update all projects without a userId
    const result = await collection.updateMany(
      { userId: { $exists: false } },
      { $set: { userId: userId } }
    )

    console.log("Claimed " + result.modifiedCount + " orphan projects for user " + userId);

    return res.status(200).json({
      success: true,
      claimedCount: result.modifiedCount,
      message: `Claimed ${result.modifiedCount} project(s)`
    })
  } catch (error) {
    console.error('❌ Error claiming orphans:', error)
    return res.status(500).json({
      error: 'Failed to claim projects',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
