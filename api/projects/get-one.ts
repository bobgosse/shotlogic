// api/projects/get-one.ts - Fetches a single, complete project document by ID
import { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function (req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Expecting the project ID to be passed as a query parameter: /api/projects/get-one?projectId=...
    const { projectId } = req.query;

    if (!projectId || Array.isArray(projectId)) {
        return res.status(400).json({ error: 'Missing or invalid projectId parameter.' });
    }

    try {
        const db = await getDb();
        const collection = db.collection('projects');
        
        let objectId;
        try {
            // Convert the string ID back into a MongoDB ObjectId for the lookup
            objectId = new ObjectId(projectId);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid MongoDB project ID format.' });
        }

        // Find the project document
        const project = await collection.findOne({ _id: objectId });

        if (!project) {
            return res.status(404).json({ error: `Project with ID ${projectId} not found.` });
        }

        // Return the core project data payload
        return res.status(200).json({ 
            success: true, 
            projectId: project._id.toHexString(),
            projectName: project.name,
            projectData: project.data // This contains the scenes, visualStyle, etc.
        });

    } catch (error) {
        console.error('Fetch One Project Error:', error);
        return res.status(500).json({ error: 'Failed to fetch project details from the database.' });
    }
}