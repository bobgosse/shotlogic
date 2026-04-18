#!/usr/bin/env node
// Backfill: grant 100 starting credits to users whose doc was created without a
// credits field (caused by the pre-fix onboarding.ts upsert poisoning issue).
//
// Usage:
//   node --env-file=.env.local scripts/backfill-credits.mjs           # dry run (default)
//   node --env-file=.env.local scripts/backfill-credits.mjs --apply   # actually write
//
// Reads MONGODB_URI from the environment. Does NOT hardcode credentials.

import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = 'ShotLogicDB'
const STARTING_CREDITS = 100

const APPLY = process.argv.includes('--apply')
const MODE = APPLY ? 'APPLY (will write)' : 'DRY RUN (no writes — pass --apply to write)'

if (!MONGODB_URI) {
  console.error('MONGODB_URI not set in environment. Pass --env-file=.env.local or export it.')
  process.exit(1)
}

function redact(userId) {
  if (!userId) return 'NO_ID'
  return userId.slice(0, 8) + '…'
}

async function main() {
  console.log(`Mode: ${MODE}\n`)
  const client = new MongoClient(MONGODB_URI)

  try {
    await client.connect()
    const db = client.db(DB_NAME)
    const users = db.collection('users')
    const projects = db.collection('projects')

    const victims = await users.find({ credits: { $exists: false } }).toArray()
    console.log(`Users missing credits field: ${victims.length}\n`)

    if (victims.length === 0) {
      console.log('Nothing to backfill.')
      return
    }

    console.log('Per-victim details:')
    console.log('uid          | createdAt            | hasPurchases | hasProjects')
    console.log('-'.repeat(74))
    for (const v of victims) {
      const hasPurchases = Array.isArray(v.purchaseHistory) && v.purchaseHistory.length > 0
      const projCount = v.userId ? await projects.countDocuments({ userId: v.userId }) : 0
      const createdAt = v.createdAt ? new Date(v.createdAt).toISOString().slice(0, 19) : '-'
      console.log(
        `${redact(v.userId).padEnd(12)} | ${createdAt.padEnd(20)} | ${String(hasPurchases).padEnd(12)} | ${projCount > 0 ? `yes (${projCount})` : 'no'}`
      )
    }

    const withPurchases = victims.filter(v => Array.isArray(v.purchaseHistory) && v.purchaseHistory.length > 0)
    if (withPurchases.length > 0) {
      console.log(`\nWARNING: ${withPurchases.length} victim(s) already have purchaseHistory entries.`)
      console.log('Backfill will NOT overwrite purchaseHistory (uses $set on credits/usageHistory only).')
      console.log('Review before proceeding:')
      for (const v of withPurchases) console.log('  -', redact(v.userId), 'purchases=', v.purchaseHistory.length)
    }

    if (!APPLY) {
      console.log(`\nDry run complete. Would grant ${STARTING_CREDITS} credits to ${victims.length} user(s).`)
      console.log('Re-run with --apply to write changes.')
      return
    }

    console.log(`\nApplying backfill: ${STARTING_CREDITS} credits to ${victims.length} user(s)...`)
    // Preserve any existing purchaseHistory; only fill what's missing.
    const result = await users.updateMany(
      { credits: { $exists: false } },
      [
        {
          $set: {
            credits: STARTING_CREDITS,
            purchaseHistory: { $ifNull: ['$purchaseHistory', []] },
            usageHistory: { $ifNull: ['$usageHistory', []] },
            backfilledAt: new Date(),
          },
        },
      ]
    )

    console.log(`\nBackfill result:`)
    console.log(`  matched: ${result.matchedCount}`)
    console.log(`  modified: ${result.modifiedCount}`)
    console.log(`\nBackfilled user prefixes:`)
    for (const v of victims) console.log('  -', redact(v.userId))
  } finally {
    await client.close()
  }
}

main().catch(err => {
  console.error('Backfill failed:', err.message)
  process.exit(1)
})
