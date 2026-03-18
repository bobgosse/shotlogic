// api/user/onboarding.ts
// GET: Check if user has completed onboarding
// POST: Mark onboarding as completed

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { logger } from '../lib/logger.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  const userId = (req.query.userId as string) ||
    (req.headers['x-user-id'] as string) ||
    (req.body?.userId as string)

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  try {
    const db = await getDb()
    const users = db.collection('users')

    if (req.method === 'GET') {
      const user = await users.findOne({ userId }, { projection: { onboardingCompleted: 1 } })
      return res.status(200).json({
        onboardingCompleted: user?.onboardingCompleted || false
      })
    }

    if (req.method === 'POST') {
      await users.updateOne(
        { userId },
        { $set: { onboardingCompleted: true, onboardingCompletedAt: new Date() } },
        { upsert: true }
      )
      logger.log('onboarding', `Marked onboarding complete for ${userId}`)
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    logger.error('onboarding', 'Error:', error)
    return res.status(500).json({ error: error.message || 'Failed' })
  }
}
