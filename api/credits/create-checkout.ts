// api/credits/create-checkout.ts
// Create Stripe Checkout session for purchasing credits

import { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { logger } from '../lib/logger.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

// Credit pack configurations
const CREDIT_PACKS = {
  starter: { credits: 50, price: 1500, name: '50 Scenes' }, // $15.00
  standard: { credits: 150, price: 3500, name: '150 Scenes' }, // $35.00
  pro: { credits: 500, price: 10000, name: '500 Scenes' }, // $100.00
  bulk: { credits: 1500, price: 25000, name: '1500 Scenes' }, // $250.00
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }
  
  try {
    const { userId, pack } = req.body
    
    if (!userId || !pack) {
      return res.status(400).json({ error: 'userId and pack are required' })
    }
    
    const packConfig = CREDIT_PACKS[pack as keyof typeof CREDIT_PACKS]
    if (!packConfig) {
      return res.status(400).json({ error: 'Invalid pack type' })
    }
    
    logger.log('create-checkout', `[${invocationId}] Creating checkout for ${userId}, pack: ${pack}`)
    
    // Get the origin for success/cancel URLs
    const origin = req.headers.origin || req.headers.referer || 'https://shotlogic.studio'
    const baseUrl = origin.replace(/\/$/, '')
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `ShotLogic Credits - ${packConfig.name}`,
              description: `${packConfig.credits} scene analysis credits`,
            },
            unit_amount: packConfig.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/projects?credits=success`,
      cancel_url: `${baseUrl}/buy-credits?canceled=true`,
      client_reference_id: userId,
      metadata: {
        userId,
        credits: packConfig.credits.toString(),
        pack,
      },
    })
    
    logger.log('create-checkout', `[${invocationId}] Checkout session created: ${session.id}`)
    
    res.status(200).json({ sessionId: session.id, url: session.url })
  } catch (error: any) {
    logger.error('create-checkout', `[${invocationId}] Error:`, error)
    res.status(500).json({ error: error.message || 'Failed to create checkout session' })
  }
}
