// api/lib/rateLimit.ts
// Two rate limiters for AI-calling endpoints:
//   aiIpLimiter   — 20/min per IP,  pre-auth, blocks unauthenticated floods cheaply.
//   aiUserLimiter — 20/hour per user, post-auth, blocks authenticated-user abuse.

import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

const limitHandler = (_req: any, res: any) => {
  res.status(429).json({
    error: 'Rate limit exceeded',
    userMessage: "You've hit the hourly AI request limit. Please try again in an hour.",
  })
}

export const aiIpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => ipKeyGenerator(req.ip ?? ''),
  handler: limitHandler,
})

export const aiUserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? ''),
  handler: limitHandler,
})
