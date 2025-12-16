// api/projects/get-all.ts - Fetches a list of all saved projects for the Dashboard
import { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../lib/mongodb';

export default async function (req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const db = await getDb();
        const collection = db.collection('projects');

        // Fetch only the necessary fields: _id, name, and updatedAt
        const projectList = await collection.find({})
            .project({ name: 1, updatedAt: 1 })
            .sort({ updatedAt: -1 }) // Sort by most recently updated
            .toArray();

        // Map the results to clean up the data for the frontend
        const projects = projectList.map(project => ({
            id: project._id.toHexString(), // Convert MongoDB ObjectId to a string
            name: project.name,
            updatedAt: project.updatedAt.toISOString(), // Standard date string
        }));

        return res.status(200).json({ success: true, projects });

    } catch (error) {
        console.error('Fetch Projects Error:', error);
        return res.status(500).json({ error: 'Failed to fetch projects from the database.' });
    }
}