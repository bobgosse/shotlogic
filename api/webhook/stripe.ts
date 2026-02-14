// api/webhook/stripe.ts
// Handle Stripe webhook events (payment success)

import { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { addCredits } from '../lib/credits.js'
import { logger } from '../lib/logger.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

// Disable body parsing so we can verify webhook signature
export const config = {
  api: {
    bodyParser: false,
  },
}

// Helper to read raw body
async function buffer(readable: any) {
  const chunks = []
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }
  
  try {
    const buf = await buffer(req)
    const sig = req.headers['stripe-signature']
    
    if (!sig) {
      logger.error('stripe-webhook', `[${invocationId}] No signature header`)
      return res.status(400).json({ error: 'No signature' })
    }
    
    let event: Stripe.Event
    
    try {
      event = stripe.webhooks.constructEvent(buf, sig, webhookSecret)
    } catch (err: any) {
      logger.error('stripe-webhook', `[${invocationId}] Signature verification failed:`, err.message)
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` })
    }
    
    logger.log('stripe-webhook', `[${invocationId}] Event: ${event.type}`)
    
    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      
      const userId = session.client_reference_id || session.metadata?.userId
      const credits = parseInt(session.metadata?.credits || '0', 10)
      const amountTotal = session.amount_total || 0
      
      if (!userId || !credits) {
        logger.error('stripe-webhook', `[${invocationId}] Missing userId or credits in session metadata`)
        return res.status(400).json({ error: 'Missing required metadata' })
      }
      
      logger.log('stripe-webhook', `[${invocationId}] Adding ${credits} credits to ${userId}`)
      
      try {
        const newBalance = await addCredits(
          userId,
          amountTotal / 100, // Convert cents to dollars
          credits,
          session.payment_intent as string
        )
        
        logger.log('stripe-webhook', `[${invocationId}] Credits added. New balance: ${newBalance}`)
      } catch (error: any) {
        logger.error('stripe-webhook', `[${invocationId}] Failed to add credits:`, error)
        return res.status(500).json({ error: 'Failed to add credits' })
      }
    }
    
    res.status(200).json({ received: true })
  } catch (error: any) {
    logger.error('stripe-webhook', `[${invocationId}] Error:`, error)
    res.status(500).json({ error: error.message || 'Webhook processing failed' })
  }
}
