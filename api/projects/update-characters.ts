// api/projects/update-characters.ts
// Updates project character definitions in MongoDB
import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'
import { ObjectId } from 'mongodb'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  
  try {
    const { projectId, characters } = req.body
    
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' })
    }
    
    console.log(`👥 Updating characters for project ${projectId}`)
    console.log(`   Character count: ${characters?.length || 0}`)
    
    const db = await getDb()
    const collection = db.collection('projects')
    
    const result = await collection.updateOne(
      { _id: new ObjectId(projectId) },
      { 
        $set: { 
          characters: characters || [],
          updatedAt: new Date()
        }
      }
    )
    
    console.log(`✅ Characters updated, modified: ${result.modifiedCount}`)
    
    return res.status(200).json({
      success: true,
      message: 'Characters updated',
      modifiedCount: result.modifiedCount
    })
  } catch (error) {
    console.error('Update error:', error)
    return res.status(500).json({
      error: 'Failed to update',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
