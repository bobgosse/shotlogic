// api/credits/get-balance.ts
// Get user's current credit balance and history

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserCredits } from '../lib/credits.js'
import { getDb } from '../lib/mongodb.js'
import { logger } from '../lib/logger.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }
  
  try {
    // Get userId from query or header
    const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string)
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }
    
    logger.log('get-balance', `[${invocationId}] Getting balance for userId: ${userId}`)
    
    const credits = await getUserCredits(userId)
    
    // Get full user record for history
    const db = await getDb()
    const user = await db.collection('users').findOne({ userId })
    
    logger.log('get-balance', `[${invocationId}] Balance: ${credits}`)
    
    res.status(200).json({ 
      userId,
      credits,
      purchaseHistory: user?.purchaseHistory || [],
      usageHistory: user?.usageHistory || [],
    })
  } catch (error: any) {
    logger.error('get-balance', `[${invocationId}] Error:`, error)
    res.status(500).json({ error: error.message || 'Failed to get credit balance' })
  }
}
