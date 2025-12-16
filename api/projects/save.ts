// api/projects/save.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../lib/mongodb.js'; // CRITICAL: Must use .js extension
import { ObjectId } from 'mongodb';

const DEPLOY_TIMESTAMP = '2024-12-16T12:58:00Z_SAVE_INIT';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const startTime = Date.now();
  
  // Only allow POST requests for saving data
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const projectData = req.body;
    
    // Basic validation
    if (!projectData || !projectData.name) {
      return res.status(400).json({ 
        error: 'Missing project data or name',
        message: 'The request body must include a project name.' 
      });
    }

    // 1. Establish database connection
    const db = await getDb();
    const collection = db.collection('projects');
    
    // 2. Prepare data for insertion/update
    const now = new Date();
    const projectToSave = {
      ...projectData,
      updatedAt: now,
      createdAt: projectData.createdAt || now, // Preserve createdAt if it exists
    };

    // 3. Insert the new project
    const result = await collection.insertOne(projectToSave);

    const duration = Date.now() - startTime;
    console.log(`✅ Project saved in ${duration}ms. ID: ${result.insertedId}`);

    return res.status(201).json({
      success: true,
      id: result.insertedId.toHexString(),
      message: 'Project successfully saved',
      deployMarker: DEPLOY_TIMESTAMP
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ FATAL ERROR in save.ts after ${duration}ms:`, error);
    
    // CRITICAL: Ensure we return JSON on error, not an HTML page.
    return res.status(500).json({
      error: 'Failed to save project to cloud database',
      details: error instanceof Error ? error.message : 'Unknown server error',
      deployMarker: DEPLOY_TIMESTAMP,
      processingTime: duration
    });
  }
}