// api/debug/whoami.ts
// Debug endpoint to check current user's Clerk ID

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { logger } from '../lib/logger.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const { userId } = req.body || req.query
    
    logger.log('debug-whoami', `🔍 Whoami request - userId: "${userId}" (type: ${typeof userId})`)
    
    return res.status(200).json({
      success: true,
      userId: userId,
      userIdType: typeof userId,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    logger.error('debug-whoami', 'Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
