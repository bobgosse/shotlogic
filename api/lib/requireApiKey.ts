// api/lib/requireApiKey.ts
// X-API-Key header check, reusing the pattern from api/admin/analysis-health.ts.

import type { Request, Response, NextFunction } from 'express'

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key']
  const expectedKey = process.env.ADMIN_API_KEY

  if (!expectedKey) {
    return res.status(503).json({
      error: 'Admin endpoint not configured',
      message: 'ADMIN_API_KEY environment variable is not set',
    })
  }

  const provided = Array.isArray(apiKey) ? apiKey[0] : apiKey
  if (provided !== expectedKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key',
    })
  }

  return next()
}
