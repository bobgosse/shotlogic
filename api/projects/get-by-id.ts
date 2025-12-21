// api/projects/get-by-id.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const projectId = req.query.projectId as string;

    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ 
        error: 'Missing or invalid project ID' 
      });
    }

    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(projectId)) {
      return res.status(400).json({ 
        error: 'Invalid project ID format' 
      });
    }

    const db = await getDb();
    const collection = db.collection('projects');
    
    const project = await collection.findOne({ 
      _id: new ObjectId(projectId) 
    });

    if (!project) {
      return res.status(404).json({ 
        success: false,
        error: 'Project not found' 
      });
    }

    console.log(`✅ Project ${projectId} loaded`);

    return res.status(200).json({
      success: true,
      project: project
    });

  } catch (error) {
    console.error('❌ Load error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to load project',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}