// api/lib/credits.ts
// User credits management for scene analysis billing

import { getDb } from './mongodb.js'
import { logger } from './logger.js'

// Admin users get unlimited credits
const ADMIN_USER_IDS = [
  process.env.ADMIN_USER_ID || 'user_37UsTRYS4w4EQq21A2AHYpV6cf2', // Bob's Clerk user ID
]

function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId)
}

export interface UserCredits {
  userId: string
  credits: number
  isAdmin?: boolean
  isTester?: boolean
  purchaseHistory: {
    amount: number
    credits: number
    timestamp: Date
    stripePaymentIntent?: string
  }[]
  usageHistory: {
    sceneId?: string
    projectId?: string
    credits: number
    timestamp: Date
  }[]
  adminGrants?: {
    credits: number
    reason: string
    grantedBy: string
    timestamp: Date
  }[]
  adminAdjustments?: {
    credits: number
    reason: string
    adjustedBy: string
    timestamp: Date
  }[]
  createdAt: Date
  updatedAt: Date
}

/**
 * Get user's credit balance (creates user record if doesn't exist)
 */
export async function getUserCredits(userId: string): Promise<number> {
  try {
    const db = await getDb()
    const users = db.collection<UserCredits>('users')
    
    let user = await users.findOne({ userId })
    
    if (!user) {
      // Create new user with 0 credits
      user = {
        userId,
        credits: 0,
        purchaseHistory: [],
        usageHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await users.insertOne(user as any)
      logger.log('credits', `Created new user: ${userId} with 0 credits`)
    }
    
    return user.credits
  } catch (error) {
    logger.error('credits', `Failed to get credits for ${userId}:`, error)
    throw new Error('Failed to retrieve credit balance')
  }
}

/**
 * Add credits to user account (after successful payment)
 */
export async function addCredits(
  userId: string,
  amount: number,
  credits: number,
  stripePaymentIntent?: string
): Promise<number> {
  try {
    const db = await getDb()
    const users = db.collection<UserCredits>('users')
    
    const result = await users.findOneAndUpdate(
      { userId },
      {
        $inc: { credits },
        $push: {
          purchaseHistory: {
            amount,
            credits,
            timestamp: new Date(),
            stripePaymentIntent,
          },
        },
        $set: { updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date(), usageHistory: [] },
      },
      { upsert: true, returnDocument: 'after' }
    )
    
    const newBalance = result?.credits || credits
    logger.log('credits', `Added ${credits} credits to ${userId}. New balance: ${newBalance}`)
    
    return newBalance
  } catch (error) {
    logger.error('credits', `Failed to add credits for ${userId}:`, error)
    throw new Error('Failed to add credits')
  }
}

/**
 * Deduct credits from user account (for scene analysis)
 * Admin users don't have credits deducted but usage is still logged
 */
export async function deductCredits(
  userId: string,
  credits: number,
  sceneId?: string,
  projectId?: string
): Promise<number> {
  try {
    const db = await getDb()
    const users = db.collection<UserCredits>('users')
    
    // Admin users bypass deduction but still log usage
    if (isAdmin(userId)) {
      await users.updateOne(
        { userId },
        {
          $push: {
            usageHistory: {
              sceneId,
              projectId,
              credits: 0, // Admin usage tracked as 0 cost
              timestamp: new Date(),
            },
          },
          $set: { updatedAt: new Date() },
          $setOnInsert: { 
            createdAt: new Date(), 
            credits: 999999, // Give admins a high balance for display
            isAdmin: true,
            purchaseHistory: [],
          },
        },
        { upsert: true }
      )
      logger.log('credits', `Admin ${userId} used analysis (no charge). Usage logged.`)
      return 999999 // Return high number for admins
    }
    
    // Check balance first for regular users
    const user = await users.findOne({ userId })
    if (!user || user.credits < credits) {
      throw new Error('Insufficient credits')
    }
    
    const result = await users.findOneAndUpdate(
      { userId, credits: { $gte: credits } }, // Ensure balance didn't change
      {
        $inc: { credits: -credits },
        $push: {
          usageHistory: {
            sceneId,
            projectId,
            credits,
            timestamp: new Date(),
          },
        },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    )
    
    if (!result) {
      throw new Error('Insufficient credits or concurrent modification')
    }
    
    const newBalance = result.credits
    logger.log('credits', `Deducted ${credits} from ${userId}. New balance: ${newBalance}`)
    
    return newBalance
  } catch (error) {
    logger.error('credits', `Failed to deduct credits for ${userId}:`, error)
    throw error
  }
}

/**
 * Check if user has enough credits (admins always have unlimited)
 */
export async function hasEnoughCredits(userId: string, required: number): Promise<boolean> {
  try {
    // Admin users bypass credit checks
    if (isAdmin(userId)) {
      logger.log('credits', `Admin user ${userId} bypassing credit check`)
      return true
    }
    
    const balance = await getUserCredits(userId)
    return balance >= required
  } catch (error) {
    logger.error('credits', `Failed to check credits for ${userId}:`, error)
    return false
  }
}
