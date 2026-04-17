// api/projects/claim-orphans.ts
// Claims all projects without a userId and assigns them to the requesting user

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { logger } from "../lib/logger";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS handled by server.mjs middleware

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // Force userId from verified session — ignore body.userId.
  const userId = (req as any).auth?.userId as string | undefined

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    const db = await getDb()
    const collection = db.collection('projects')

    // Find and update all projects without a userId
    const result = await collection.updateMany(
      { userId: { $exists: false } },
      { $set: { userId: userId } }
    )

    logger.log("claim-orphans", "Claimed " + result.modifiedCount + " orphan projects for user " + userId);

    return res.status(200).json({
      success: true,
      claimedCount: result.modifiedCount,
      message: `Claimed ${result.modifiedCount} project(s)`
    })
  } catch (error) {
    logger.error("claim-orphans", '❌ Error claiming orphans:', error)
    return res.status(500).json({
      error: 'Failed to claim projects',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
