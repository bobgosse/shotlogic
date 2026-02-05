// api/lib/mongodb.ts
// PRODUCTION-READY MongoDB connection utility for Vercel serverless functions

import { MongoClient, Db, MongoClientOptions } from 'mongodb'
import { logger } from "./logger";

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = 'ShotLogicDB'

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable in Vercel settings'
  )
}

// Extend global type to include MongoDB client promise
declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

// MongoDB client options optimized for serverless
const options: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 1,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
}

let clientPromise: Promise<MongoClient>

// CRITICAL: Use consistent caching pattern for both dev and production
if (process.env.NODE_ENV === 'development') {
  // In development, use a global variable so connection persists across hot-reloads
  if (!global._mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI, options)
    global._mongoClientPromise = client.connect()
  }
  clientPromise = global._mongoClientPromise
} else {
  // In production, also use global to ensure connection persists across warm starts
  // This is critical for Vercel's execution model
  if (!global._mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI, options)
    global._mongoClientPromise = client.connect()
  }
  clientPromise = global._mongoClientPromise
}

/**
 * Get MongoDB database instance
 * Returns a cached connection for performance in serverless environment
 * DO NOT close this connection - it's meant to be reused
 */
export async function getDb(): Promise<Db> {
  try {
    const client = await clientPromise
    
    // Verify connection is still alive
    await client.db(DB_NAME).admin().ping()
    
    return client.db(DB_NAME)
  } catch (error) {
    logger.error("mongodb", 'MongoDB connection error:', error)
    
    // If connection failed, clear the cached promise and retry once
    global._mongoClientPromise = undefined
    const client = new MongoClient(MONGODB_URI, options)
    global._mongoClientPromise = client.connect()
    clientPromise = global._mongoClientPromise
    
    const newClient = await clientPromise
    return newClient.db(DB_NAME)
  }
}

/**
 * Get MongoDB client instance
 * DO NOT close this client - it's shared across invocations
 */
export async function getClient(): Promise<MongoClient> {
  try {
    return await clientPromise
  } catch (error) {
    logger.error("mongodb", 'MongoDB client error:', error)
    throw new Error(
      `Failed to get MongoDB client: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

// Export the promise for compatibility
export default clientPromise