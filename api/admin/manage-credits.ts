// api/admin/manage-credits.ts
// Admin endpoint to manage user credits (grant free credits, view balances)

import { VercelRequest, VercelResponse } from '@vercel/node'
import { addCredits, getUserCredits } from '../lib/credits.js'
import { logger } from '../lib/logger.js'
import { getDb } from '../lib/mongodb.js'

// Admin API key check (Bob's user ID or special admin key)
const ADMIN_USER_IDS = [
  process.env.ADMIN_USER_ID || 'user_37UsTRYS4w4EQq21A2AHYpV6cf2', // Bob's Clerk user ID
]

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'shotlogic-admin-dev-key'

function isAdmin(userId?: string, apiKey?: string): boolean {
  if (apiKey === ADMIN_API_KEY) return true
  if (userId && ADMIN_USER_IDS.includes(userId)) return true
  return false
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  try {
    // Check admin authorization
    const authUserId = req.headers['x-user-id'] as string
    const apiKey = req.headers['x-api-key'] as string
    
    if (!isAdmin(authUserId, apiKey)) {
      logger.warn('manage-credits', `[${invocationId}] Unauthorized access attempt from ${authUserId || 'unknown'}`)
      return res.status(403).json({ error: 'Unauthorized - Admin access required' })
    }
    
    // GET: Get user's credit balance
    if (req.method === 'GET') {
      const { userId } = req.query
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'userId query parameter required' })
      }
      
      const credits = await getUserCredits(userId)
      const db = await getDb()
      const user = await db.collection('users').findOne({ userId })
      
      logger.log('manage-credits', `[${invocationId}] Retrieved balance for ${userId}: ${credits}`)
      
      return res.status(200).json({
        userId,
        credits,
        purchaseHistory: user?.purchaseHistory || [],
        usageHistory: user?.usageHistory || [],
      })
    }
    
    // POST: Grant credits to user (free admin grant)
    if (req.method === 'POST') {
      const { userId, credits, reason } = req.body
      
      if (!userId || typeof credits !== 'number' || credits <= 0) {
        return res.status(400).json({ error: 'Valid userId and positive credits amount required' })
      }
      
      logger.log('manage-credits', `[${invocationId}] Granting ${credits} credits to ${userId}. Reason: ${reason || 'Admin grant'}`)
      
      const newBalance = await addCredits(
        userId,
        0, // $0 - free admin grant
        credits,
        `admin_grant_${invocationId}`
      )
      
      // Also update a note in the user record
      const db = await getDb()
      await db.collection('users').updateOne(
        { userId },
        {
          $push: {
            adminGrants: {
              credits,
              reason: reason || 'Admin grant',
              grantedBy: authUserId,
              timestamp: new Date(),
            },
          },
        }
      )
      
      logger.log('manage-credits', `[${invocationId}] Successfully granted ${credits} credits to ${userId}. New balance: ${newBalance}`)
      
      return res.status(200).json({
        success: true,
        userId,
        creditsGranted: credits,
        newBalance,
        reason: reason || 'Admin grant',
      })
    }
    
    // DELETE: Deduct credits (for testing/corrections)
    if (req.method === 'DELETE') {
      const { userId, credits, reason } = req.body
      
      if (!userId || typeof credits !== 'number' || credits <= 0) {
        return res.status(400).json({ error: 'Valid userId and positive credits amount required' })
      }
      
      logger.log('manage-credits', `[${invocationId}] Removing ${credits} credits from ${userId}. Reason: ${reason || 'Admin correction'}`)
      
      const db = await getDb()
      const result = await db.collection('users').findOneAndUpdate(
        { userId },
        {
          $inc: { credits: -credits },
          $push: {
            adminAdjustments: {
              credits: -credits,
              reason: reason || 'Admin correction',
              adjustedBy: authUserId,
              timestamp: new Date(),
            },
          },
          $set: { updatedAt: new Date() },
        },
        { returnDocument: 'after' }
      )
      
      const newBalance = result?.credits || 0
      
      logger.log('manage-credits', `[${invocationId}] Removed ${credits} credits from ${userId}. New balance: ${newBalance}`)
      
      return res.status(200).json({
        success: true,
        userId,
        creditsRemoved: credits,
        newBalance,
        reason: reason || 'Admin correction',
      })
    }
    
    return res.status(405).json({ error: 'Method Not Allowed' })
    
  } catch (error: any) {
    logger.error('manage-credits', `[${invocationId}] Error:`, error)
    return res.status(500).json({ error: error.message || 'Failed to manage credits' })
  }
}
