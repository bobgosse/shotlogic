// api/webhook/clerk.ts
// Handle Clerk webhook events (new user signup notifications)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Webhook } from 'svix'
import { Resend } from 'resend'
import { logger } from '../lib/logger.js'
import { getDb } from '../lib/mongodb.js'

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
const resend = new Resend(process.env.RESEND_API_KEY)

interface ClerkUserEvent {
  data: {
    id: string
    first_name: string | null
    last_name: string | null
    email_addresses: Array<{
      email_address: string
      id: string
    }>
    created_at: number
    image_url: string | null
  }
  type: string
}

async function sendSignupEmail(userData: ClerkUserEvent['data']) {
  const name = [userData.first_name, userData.last_name].filter(Boolean).join(' ') || 'Unknown'
  const email = userData.email_addresses?.[0]?.email_address || 'No email'
  const signupDate = new Date(userData.created_at).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  await resend.emails.send({
    from: 'ShotLogic <onboarding@resend.dev>',
    to: 'bobgosse@gmail.com',
    subject: `🎬 New ShotLogic signup: ${name}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #E50914; margin-bottom: 4px;">New User Signed Up</h2>
        <table style="border-collapse: collapse; width: 100%;">
          <tr>
            <td style="padding: 8px 12px; color: #888; width: 80px;">Name</td>
            <td style="padding: 8px 12px; font-weight: 600;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; color: #888;">Email</td>
            <td style="padding: 8px 12px;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; color: #888;">Clerk ID</td>
            <td style="padding: 8px 12px; font-family: monospace; font-size: 13px;">${userData.id}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; color: #888;">Signed up</td>
            <td style="padding: 8px 12px;">${signupDate}</td>
          </tr>
        </table>
        <p style="color: #666; font-size: 13px; margin-top: 16px;">
          They received 100 free credits. Manage their account at
          <a href="https://shotlogic.studio/admin/credits">Admin Dashboard</a>.
        </p>
      </div>
    `,
  })

  logger.log('clerk-webhook', `Signup notification email sent for ${name} (${email})`)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  if (!webhookSecret) {
    logger.error('clerk-webhook', `[${invocationId}] CLERK_WEBHOOK_SECRET not configured`)
    return res.status(500).json({ error: 'Webhook secret not configured' })
  }

  try {
    // Verify webhook signature using svix
    const wh = new Webhook(webhookSecret)
    const headers = {
      'svix-id': req.headers['svix-id'] as string,
      'svix-timestamp': req.headers['svix-timestamp'] as string,
      'svix-signature': req.headers['svix-signature'] as string,
    }

    // Use rawBody captured before express.json() parsed the stream
    const payload = (req as any).rawBody || JSON.stringify(req.body)

    let event: ClerkUserEvent
    try {
      event = wh.verify(payload, headers) as ClerkUserEvent
    } catch (err: any) {
      logger.error('clerk-webhook', `[${invocationId}] Signature verification failed:`, err.message)
      return res.status(400).json({ error: 'Invalid webhook signature' })
    }

    logger.log('clerk-webhook', `[${invocationId}] Event: ${event.type}`)

    // Respond immediately — Clerk requires a response within 30s
    res.status(200).json({ received: true })

    // Background work — don't block the 200 response on Mongo or Resend latency.
    if (event.type === 'user.created') {
      // Create canonical user doc with starting credits. $setOnInsert means
      // this is a no-op if a doc already exists (e.g. from onboarding race).
      ;(async () => {
        const db = await getDb()
        await db.collection('users').updateOne(
          { userId: event.data.id },
          {
            $setOnInsert: {
              userId: event.data.id,
              credits: 100,
              purchaseHistory: [],
              usageHistory: [],
              createdAt: new Date(),
              onboardingCompleted: false,
            },
          },
          { upsert: true }
        )
        logger.log('clerk-webhook', `[${invocationId}] Ensured user row for ${event.data.id} with 100 starting credits`)
      })().catch((dbErr: any) => {
        logger.error('clerk-webhook', `[${invocationId}] Failed to create user row:`, dbErr.message)
      })

      sendSignupEmail(event.data).catch((emailErr: any) => {
        logger.error('clerk-webhook', `[${invocationId}] Failed to send notification email:`, emailErr.message)
      })
    }
  } catch (error: any) {
    logger.error('clerk-webhook', `[${invocationId}] Error:`, error)
    res.status(500).json({ error: error.message || 'Webhook processing failed' })
  }
}
