// api/admin/users.ts
// Admin endpoint to list all users with aggregated activity data

import { VercelRequest, VercelResponse } from '@vercel/node'
import { logger } from '../lib/logger.js'
import { getDb } from '../lib/mongodb.js'

const ADMIN_USER_IDS = [
  process.env.ADMIN_USER_ID || 'user_37UsTRYS4w4EQq21A2AHYpV6cf2',
  'bobgosse@gmail.com',
  'bob@shotlogic.studio'
]

function isAdmin(userId?: string): boolean {
  return !!userId && ADMIN_USER_IDS.includes(userId)
}

interface ClerkUser {
  id: string
  first_name: string | null
  last_name: string | null
  email_addresses: Array<{ email_address: string }>
  created_at: number
}

async function fetchClerkUsers(): Promise<Map<string, ClerkUser>> {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    logger.warn('admin-users', 'CLERK_SECRET_KEY not configured — user names will be unavailable')
    return new Map()
  }

  const users = new Map<string, ClerkUser>()
  let offset = 0
  const limit = 100

  // Paginate through all Clerk users
  while (true) {
    const res = await fetch(`https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })

    if (!res.ok) {
      logger.error('admin-users', `Clerk API error: ${res.status} ${await res.text()}`)
      break
    }

    const batch: ClerkUser[] = await res.json()
    if (batch.length === 0) break

    for (const u of batch) {
      users.set(u.id, u)
    }

    if (batch.length < limit) break
    offset += limit
  }

  return users
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const authUserId = req.headers['x-user-id'] as string
  if (!isAdmin(authUserId)) {
    return res.status(403).json({ error: 'Unauthorized — Admin access required' })
  }

  try {
    const db = await getDb()

    // Fetch all data in parallel
    const [mongoUsers, clerkUsers, projectAgg] = await Promise.all([
      // All user records from MongoDB
      db.collection('users').find({}).toArray(),
      // All user details from Clerk
      fetchClerkUsers(),
      // Aggregate project and scene counts per user
      db.collection('projects').aggregate([
        {
          $project: {
            userId: 1,
            updatedAt: 1,
            sceneCount: {
              $cond: {
                if: { $isArray: '$scenes' },
                then: { $size: '$scenes' },
                else: 0
              }
            },
            analyzedSceneCount: {
              $cond: {
                if: { $isArray: '$scenes' },
                then: {
                  $size: {
                    $filter: {
                      input: '$scenes',
                      cond: { $ne: [{ $ifNull: ['$$this.analysis', null] }, null] }
                    }
                  }
                },
                else: 0
              }
            }
          }
        },
        {
          $group: {
            _id: '$userId',
            projectCount: { $sum: 1 },
            totalScenes: { $sum: '$sceneCount' },
            analyzedScenes: { $sum: '$analyzedSceneCount' },
            lastActive: { $max: '$updatedAt' }
          }
        }
      ]).toArray()
    ])

    // Build lookup map for project aggregation
    const projectMap = new Map<string, any>()
    for (const p of projectAgg) {
      projectMap.set(p._id, p)
    }

    // Merge all data sources into a single user list
    const userList = mongoUsers.map((mu: any) => {
      const clerk = clerkUsers.get(mu.userId)
      const projects = projectMap.get(mu.userId)

      return {
        userId: mu.userId,
        name: clerk
          ? [clerk.first_name, clerk.last_name].filter(Boolean).join(' ') || '—'
          : '—',
        email: clerk?.email_addresses?.[0]?.email_address || mu.userId,
        credits: mu.credits ?? 0,
        projectCount: projects?.projectCount ?? 0,
        analyzedScenes: projects?.analyzedScenes ?? 0,
        lastActive: projects?.lastActive || mu.updatedAt || mu.createdAt || null,
        joined: mu.createdAt || null,
        isAdmin: ADMIN_USER_IDS.includes(mu.userId),
        isTester: mu.isTester || false,
      }
    })

    // Sort by lastActive descending (most recent first)
    userList.sort((a: any, b: any) => {
      const aTime = a.lastActive ? new Date(a.lastActive).getTime() : 0
      const bTime = b.lastActive ? new Date(b.lastActive).getTime() : 0
      return bTime - aTime
    })

    return res.status(200).json({ users: userList, total: userList.length })
  } catch (error: any) {
    logger.error('admin-users', 'Failed to fetch user list:', error)
    return res.status(500).json({ error: error.message || 'Failed to fetch users' })
  }
}
