// API Route: /api/projects/rename
// Renames a project by updating its name in MongoDB

import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || '';

export async function PATCH(request: Request) {
  console.log('📝 Rename project request received');
  
  try {
    const body = await request.json();
    const { projectId, newName } = body;

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'Project ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!newName || typeof newName !== 'string') {
      return new Response(
        JSON.stringify({ error: 'New name is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const trimmedName = newName.trim();
    
    if (trimmedName.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Project name cannot be empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (trimmedName.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Project name must be under 100 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!ObjectId.isValid(projectId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid project ID format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('shotlogic');
    const collection = db.collection('projects');

    const result = await collection.updateOne(
      { _id: new ObjectId(projectId) },
      { 
        $set: { 
          name: trimmedName,
          updatedAt: new Date().toISOString()
        } 
      }
    );

    await client.close();

    if (result.matchedCount === 0) {
      return new Response(
        JSON.stringify({ error: 'Project not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Project ${projectId} renamed to "${trimmedName}"`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Project renamed successfully',
        newName: trimmedName
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Rename error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to rename project',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(request: Request) {
  return PATCH(request);
}