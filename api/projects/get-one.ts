// api/projects/get-one.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../lib/mongodb.js'; // Adjust path if needed
import { ObjectId } from 'mongodb';

// CRITICAL FIX: Ensure MongoDB driver dependency is resolved
import { MongoClient } from 'mongodb'; 

const DEPLOY_TIMESTAMP = '2024-12-16T12:58:00Z_GET_INIT'; 

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const startTime = Date.now();
  
  // Only allow GET requests for retrieving data
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { projectId: idString } = req.query;
    
    // Basic validation
    if (!idString || Array.isArray(idString) || !ObjectId.isValid(idString)) {
      return res.status(400).json({ 
        error: 'Invalid project ID provided',
        message: 'A valid ObjectId string is required.' 
      });
    }

    const id = new ObjectId(idString as string);

    // 1. Establish database connection
    const db = await getDb();
    const collection = db.collection('projects');
    
    // 2. Find the project by ID
    // We fetch the entire document, which contains { name, projectData, createdAt, updatedAt }
    const project = await collection.findOne({ _id: id });

    if (!project) {
        return res.status(404).json({
            error: 'Project not found',
            message: `No project found with ID: ${idString}`,
            deployMarker: DEPLOY_TIMESTAMP
        });
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Project loaded in ${duration}ms. ID: ${idString}`);

    // CRITICAL FRONTEND FIX: The frontend (Index.tsx) expects 'projectName' 
    // and 'projectId' at the top level of the response, not nested inside 'projectData'.
    return res.status(200).json({
      success: true,
      projectId: project._id.toHexString(), // Return the ID explicitly
      projectName: project.name,   // CRITICAL: Return the project name separately
      projectData: project.projectData, // Return the main data object
      deployMarker: DEPLOY_TIMESTAMP,
      processingTime: duration
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ FATAL ERROR in get-one.ts after ${duration}ms:`, error);
    
    // Ensure we return JSON on error.
    return res.status(500).json({
      error: 'Failed to retrieve project from cloud database',
      details: error instanceof Error ? error.message : 'Unknown server error',
      deployMarker: DEPLOY_TIMESTAMP,
      processingTime: duration
    });
  }
}