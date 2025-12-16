// api/lib/mongodb.ts
import { MongoClient, Db } from 'mongodb';

// Replace the placeholder below with your actual MongoDB connection string
// You must get this string from your MongoDB Atlas dashboard (or equivalent)
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient>;

// This class is used to maintain a cached connection in development and production
// so Vercel serverless functions don't repeatedly establish connections.
if (process.env.NODE_ENV === 'development') {
  // In development, use a global variable so the connection is not lost
  // when files are hot-reloaded.
  if (!global._mongoClientPromise) {
    client = new MongoClient(MONGODB_URI);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production, connect and return the promise.
  client = new MongoClient(MONGODB_URI);
  clientPromise = client.connect();
}

export default clientPromise;

/**
 * Utility function to get the database instance.
 * @returns {Promise<Db>} The database instance.
 */
export async function getDb(): Promise<Db> {
    const client = await clientPromise;
    // Assuming your database name is 'ShotLogicDB'
    return client.db("ShotLogicDB"); 
}