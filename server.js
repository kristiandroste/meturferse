// server.js
// ES-modules + Node 18+ (or add "type":"module" to package.json)

import 'dotenv/config'
import express from 'express'
import path    from 'path'
import { fileURLToPath } from 'url'
import Stripe  from 'stripe'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const PORT       = process.env.PORT || 3000

// ─── STRIPE SETUP ───────────────────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️  STRIPE_SECRET_KEY is not set. Donation features will fail.')
}
if (!process.env.STRIPE_PUBLISHABLE_KEY) {
  console.warn('⚠️  STRIPE_PUBLISHABLE_KEY is not set. Client cannot initialize Stripe.')
}

// ─── DYNAMODB SETUP ────────────────────────────────────────────────────────────
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
const ddb = DynamoDBDocumentClient.from(ddbClient)
const DONATION_TABLE = process.env.DDB_DONATION_TOTALS || 'ntc_donation_totals'

const PUBLIC_DIR = path.join(__dirname, 'public')
const INDEX_HTML = path.join(PUBLIC_DIR, 'index.html')
const META_JSON  = path.join(PUBLIC_DIR, 'metadata.json')

const app = express()

// ─── STRIPE WEBHOOK (must come before JSON body parser) ────────────────────────
// Webhook requires raw body for signature verification
app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.warn('STRIPE_WEBHOOK_SECRET not set, skipping signature verification')
    // In development, parse the body manually
    let event
    try {
      event = JSON.parse(req.body.toString())
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON' })
    }
    await handleStripeEvent(event)
    return res.json({ received: true })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  await handleStripeEvent(event)
  res.json({ received: true })
})

async function handleStripeEvent(event) {
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object
    if (pi.metadata?.source === 'meturferse_donation') {
      const pmType = pi.payment_method_types?.[0] || 'card'
      const currency = pmType === 'crypto' ? 'crypto' : 'usd'

      try {
        await ddb.send(new UpdateCommand({
          TableName: DONATION_TABLE,
          Key: { currency },
          UpdateExpression: 'ADD totalCents :amt SET lastUpdated = :ts',
          ExpressionAttributeValues: {
            ':amt': pi.amount,
            ':ts': new Date().toISOString()
          }
        }))
        console.log(`Webhook: Donation recorded ${currency} +${pi.amount} cents`)
      } catch (err) {
        console.error('Error recording donation via webhook:', err)
      }
    }
  }
}

// Parse JSON bodies for API routes
app.use(express.json({ limit: '16kb' }))

// 1) Static files (index.html, metadata.json, images/, etc.)
// Use standard static file serving without conflicting cache headers
app.use(express.static(PUBLIC_DIR))

// 2) Optional JSON API endpoint
app.get('/api/metadata', (req, res) => {
  res.sendFile(META_JSON)
})

// ─── STRIPE API ROUTES ──────────────────────────────────────────────────────

// 3) Get Stripe publishable key for client initialization
app.get('/api/config', (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY })
})

// 4) Get donation price tiers from Stripe (with full product info)
app.get('/api/get-prices', async (req, res) => {
  try {
    const prices = await stripe.prices.list({
      active: true,
      type: 'one_time',
      expand: ['data.product']
    })

    // DEBUG: Log raw Stripe response (commented out)
    // console.log('=== RAW STRIPE PRICES ===')
    // console.log('Count:', prices.data.length)
    // prices.data.forEach((p, i) => {
    //   console.log(`Price ${i}:`, {
    //     id: p.id,
    //     unit_amount: p.unit_amount,
    //     nickname: p.nickname,
    //     product: typeof p.product === 'object' ? {
    //       name: p.product.name,
    //       description: p.product.description,
    //       active: p.product.active
    //     } : p.product
    //   })
    // })
    // console.log('=========================')

    // Filter to donation products and include full product info
    const donationPrices = prices.data
      .filter(price => {
        const product = price.product
        return product && typeof product === 'object' && product.active
      })
      .map(price => ({
        id: price.id,
        amount: price.unit_amount, // null for "customer chooses" prices
        currency: price.currency,
        nickname: price.nickname,
        customAmount: price.custom_unit_amount ? true : false,
        // Full product data
        productName: price.product.name,
        productDescription: price.product.description,
        productImages: price.product.images,
        productMetadata: price.product.metadata
      }))
      .filter(price => price.amount !== null) // Only include fixed-amount prices
      .sort((a, b) => (a.amount || 0) - (b.amount || 0))

    // If no fixed prices, return suggested amounts for custom donations
    if (donationPrices.length === 0) {
      res.json({
        customAmountOnly: true,
        suggestedAmounts: [500, 1000, 2500, 5000], // $5, $10, $25, $50 in cents
        currency: 'usd'
      })
      return
    }

    res.json(donationPrices)
  } catch (err) {
    console.error('Error fetching Stripe prices:', err)
    res.status(500).json({ error: 'Failed to fetch prices' })
  }
})

// 5) Create Payment Intent for donation
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, wish, email } = req.body

    if (!amount || amount < 50) { // Minimum $0.50
      return res.status(400).json({ error: 'Invalid amount. Minimum is 50 cents.' })
    }

    // Sanitize wish: alphanumeric + spaces only, max 69 chars, trimmed
    const sanitizedWish = (wish || '')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .trim()
      .slice(0, 69)

    // Validate email format if provided
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const sanitizedEmail = (email && emailRegex.test(email)) ? email.trim() : ''

    const metadata = {
      source: 'meturferse_donation'
    }
    if (sanitizedWish) {
      metadata.wish = sanitizedWish
    }
    if (sanitizedEmail) {
      metadata.email = sanitizedEmail
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Ensure integer
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata
    })

    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id })
  } catch (err) {
    console.error('Error creating payment intent:', err)
    res.status(500).json({ error: 'Failed to create payment intent' })
  }
})

// ─── DONATION TOTALS ROUTES ────────────────────────────────────────────────────

// 6) Get donation totals from DynamoDB
app.get('/api/donation-totals', async (req, res) => {
  try {
    const result = await ddb.send(new BatchGetCommand({
      RequestItems: {
        [DONATION_TABLE]: {
          Keys: [{ currency: 'usd' }, { currency: 'crypto' }]
        }
      }
    }))

    const items = result.Responses?.[DONATION_TABLE] || []
    const totals = { usd: 0, crypto: 0 }

    for (const item of items) {
      if (item.currency === 'usd') totals.usd = item.totalCents || 0
      if (item.currency === 'crypto') totals.crypto = item.totalCents || 0
    }

    res.json(totals)
  } catch (err) {
    console.error('Error fetching donation totals:', err)
    res.status(500).json({ error: 'Failed to fetch totals' })
  }
})

// 7) Record donation backup (client-side idempotent update)
app.post('/api/record-donation', async (req, res) => {
  try {
    const { paymentIntentId } = req.body
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Missing paymentIntentId' })
    }

    // Verify with Stripe that this payment succeeded
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (pi.status !== 'succeeded' || pi.metadata?.source !== 'meturferse_donation') {
      return res.status(400).json({ error: 'Invalid payment' })
    }

    const pmType = pi.payment_method_types?.[0] || 'card'
    const currency = pmType === 'crypto' ? 'crypto' : 'usd'

    // Use conditional to prevent double-counting
    try {
      await ddb.send(new UpdateCommand({
        TableName: DONATION_TABLE,
        Key: { currency },
        UpdateExpression: 'ADD totalCents :amt, recordedIds :pid SET lastUpdated = :ts',
        ConditionExpression: 'attribute_not_exists(recordedIds) OR NOT contains(recordedIds, :pidStr)',
        ExpressionAttributeValues: {
          ':amt': pi.amount,
          ':pid': new Set([paymentIntentId]),
          ':pidStr': paymentIntentId,
          ':ts': new Date().toISOString()
        }
      }))
      console.log(`Backup: Donation recorded ${currency} +${pi.amount} cents`)
      res.json({ success: true })
    } catch (err) {
      // ConditionalCheckFailedException means already recorded - that's OK
      if (err.name === 'ConditionalCheckFailedException') {
        return res.json({ success: true, alreadyRecorded: true })
      }
      throw err
    }
  } catch (err) {
    console.error('Error recording donation:', err)
    res.status(500).json({ error: 'Failed to record donation' })
  }
})

// ─── FEEDBACK ROUTE ─────────────────────────────────────────────────────────

// 6) Feedback proxy to Google Apps Script (avoids browser CORS)
const GOOGLE_SHEETS_URL = process.env.GOOGLE_SHEETS_URL
if (!GOOGLE_SHEETS_URL) {
  console.warn('⚠️  GOOGLE_SHEETS_URL is not set. Feedback submissions will fail until configured.')
}

app.post('/api/feedback', async (req, res) => {
  try {
    const { email = '', feedback = '' } = req.body || {}

    if (!email && !feedback) {
      return res.status(400).json({ result: 'error', message: 'Email or feedback is required' })
    }
    if (!GOOGLE_SHEETS_URL) {
      return res.status(500).json({ result: 'error', message: 'Server not configured: GOOGLE_SHEETS_URL missing' })
    }

    // Forward to Apps Script as JSON
    const upstream = await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, feedback })
    })

    const raw = await upstream.text()
    let data = null
    try { data = JSON.parse(raw) } catch { /* upstream might return text/HTML */ }

    if (!upstream.ok) {
      return res.status(502).json({ result: 'error', message: `Upstream error: HTTP ${upstream.status}`, upstream: raw.slice(0, 300) })
    }

    // Prefer upstream JSON success shape
    if (data && data.result === 'success') {
      return res.json(data)
    }

    // Fallback success when upstream doesn’t return JSON
    return res.json({ result: 'success', message: 'Submitted' })
  } catch (err) {
    console.error('Feedback proxy error:', err)
    return res.status(500).json({ result: 'error', message: 'Feedback proxy failed' })
  }
})

// 7) SPA fallback — no pattern string, so no RegExp parsing
app.use((req, res) => {
  res.sendFile(INDEX_HTML)
})

app.listen(PORT, () => {
  console.log(`🚀  Listening on http://localhost:${PORT}`)
})
