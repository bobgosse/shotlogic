// api/lib/requireAuth.ts
// Clerk session verification middleware for Express.
// Verifies Authorization: Bearer <jwt> via @clerk/backend, then sets req.auth = { userId }.

import type { Request, Response, NextFunction } from 'express'
import { createClerkClient, verifyToken } from '@clerk/backend'
import { logger } from './logger.js'

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string }
    }
  }
}

// Read env vars lazily at request-time so tests can override after module load.
let cachedClerk: ReturnType<typeof createClerkClient> | null = null
let cachedKey: string | undefined

function getClerk() {
  const key = process.env.CLERK_SECRET_KEY
  if (!key) return { key: undefined, clerk: null }
  if (key !== cachedKey) {
    cachedClerk = createClerkClient({ secretKey: key })
    cachedKey = key
  }
  return { key, clerk: cachedClerk }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { key, clerk } = getClerk()
  if (!key || !clerk) {
    logger.error('requireAuth', 'CLERK_SECRET_KEY not configured — auth middleware disabled')
    return res.status(503).json({
      error: 'Authentication not configured',
      message: 'CLERK_SECRET_KEY environment variable is not set',
    })
  }

  const authHeader = req.headers.authorization || req.headers.Authorization
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const token = header.slice('Bearer '.length).trim()
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    const payload = await verifyToken(token, { secretKey: key })
    const userId = payload.sub
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    req.auth = { userId }
    return next()
  } catch (err) {
    logger.warn('requireAuth', 'Token verification failed:', err instanceof Error ? err.message : err)
    return res.status(401).json({ error: 'Authentication required' })
  }
}
