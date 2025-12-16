// api/lib/mongodb.ts
// PRODUCTION-READY MongoDB connection utility for Vercel serverless functions

import { MongoClient, Db, MongoClientOptions } from 'mongodb'

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
  maxPoolSize: 10, // Limit connection pool size for serverless
  minPoolSize: 1,
  maxIdleTimeMS: 30000, // Close idle connections after 30 seconds
  serverSelectionTimeoutMS: 10000, // Fail fast if can't connect in 10 seconds
  socketTimeoutMS: 45000, // Socket timeout
  connectTimeoutMS: 10000, // Initial connection timeout
}

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable to preserve the connection
  // across hot-reloads (prevents connection exhaustion during development)
  if (!global._mongoClientPromise) {
    client = new MongoClient(MONGODB_URI, options)
    global._mongoClientPromise = client.connect()
  }
  clientPromise = global._mongoClientPromise
} else {
  // In production (Vercel), create connection but cache it module-scoped
  // Vercel keeps the module warm between invocations
  client = new MongoClient(MONGODB_URI, options)
  clientPromise = client.connect()
}

/**
 * Get MongoDB database instance
 * Returns a cached connection for performance in serverless environment
 */
export async function getDb(): Promise<Db> {
  try {
    const client = await clientPromise
    return client.db(DB_NAME)
  } catch (error) {
    console.error('MongoDB connection error:', error)
    throw new Error(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get MongoDB client instance (for advanced operations)
 */
export async function getClient(): Promise<MongoClient> {
  try {
    return await clientPromise
  } catch (error) {
    console.error('MongoDB client error:', error)
    throw new Error(`Failed to get MongoDB client: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Export the promise for compatibility
export default clientPromise