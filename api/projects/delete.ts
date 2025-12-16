// api/projects/delete.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
// CRITICAL FIX: Ensure MongoDB driver dependency is resolved
import { MongoClient } from 'mongodb'; 

const DEPLOY_TIMESTAMP = '2025-12-16T14:55:00Z_DELETE_INIT'; 

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const startTime = Date.now();
  
  // Only allow DELETE requests for deleting data
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { projectId: idString } = req.query;
    
    // Safety check for ID
    if (!idString || Array.isArray(idString) || !ObjectId.isValid(idString as string)) {
      return res.status(400).json({ 
        error: 'Invalid project ID provided',
        message: 'A valid ObjectId string is required for deletion.' 
      });
    }

    const id = new ObjectId(idString as string);

    // 1. Establish database connection
    const db = await getDb();
    const collection = db.collection('projects');
    
    // 2. Delete the project
    const result = await collection.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
        return res.status(404).json({
            error: 'Project not found',
            message: `No project found with ID: ${idString}`,
            deployMarker: DEPLOY_TIMESTAMP
        });
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Project deleted in ${duration}ms. ID: ${idString}`);

    return res.status(200).json({
      success: true,
      id: idString,
      message: 'Project successfully deleted',
      deployMarker: DEPLOY_TIMESTAMP
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ FATAL ERROR in delete.ts after ${duration}ms:`, error);
    
    return res.status(500).json({
      error: 'Failed to delete project from cloud database',
      details: error instanceof Error ? error.message : 'Unknown server error',
      deployMarker: DEPLOY_TIMESTAMP,
      processingTime: duration
    });
  }
}