import type { VercelRequest, VercelResponse } from '@vercel/node'
import { MongoClient, ObjectId } from 'mongodb'
import { logger } from "./lib/logger";

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = 'shotlogic'
const DEPLOY_TIMESTAMP = process.env.VERCEL_DEPLOYMENT_ID || 'local'

if (!MONGODB_URI) {
  throw new Error('Missing MONGODB_URI environment variable')
}

interface VisualProfile {
  color_palette_hex: string[]
  accent_colors_hex: string[]
  color_temperature: 'warm' | 'neutral' | 'cool' | 'mixed'
  lighting_style: {
    key_light_direction: string
    temperature: string
    shadow_hardness: string
    contrast_ratio: string
  }
  aspect_ratio: string
  lens_character: string
  film_stock_look: string
  post_processing: {
    grain_level: string
    color_grade_style: string
    contrast: string
    vignette: string
  }
  composition_principles: {
    symmetry_preference: string
    headroom: string
    depth_of_field: string
  }
  reference_images?: string[]
  inspiration_notes?: string
  created_at?: string
  updated_at?: string
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const invocationId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

  logger.log("visual-profile", `📸 [${invocationId}] Visual Profile API: ${req.method}`)

  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  let client: MongoClient | null = null

  try {
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI)
    await client.connect()
    const db = client.db(DB_NAME)
    const projectsCollection = db.collection('projects')

    // GET: Retrieve Visual Profile for a project
    if (req.method === 'GET') {
      const { projectId } = req.query

      if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({
          error: 'MISSING_PROJECT_ID',
          message: 'projectId query parameter is required',
          deployMarker: DEPLOY_TIMESTAMP
        })
      }

      logger.log("visual-profile", `📸 [${invocationId}] GET Visual Profile for project: ${projectId}`)

      const project = await projectsCollection.findOne({
        _id: new ObjectId(projectId)
      })

      if (!project) {
        return res.status(404).json({
          error: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
          deployMarker: DEPLOY_TIMESTAMP
        })
      }

      // Return visual_profile if exists, otherwise return null
      return res.status(200).json({
        success: true,
        visual_profile: project.visual_profile || null,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // POST: Create or Update Visual Profile for a project
    if (req.method === 'POST' || req.method === 'PUT') {
      const { projectId, visualProfile } = req.body

      if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({
          error: 'MISSING_PROJECT_ID',
          message: 'projectId is required in request body',
          deployMarker: DEPLOY_TIMESTAMP
        })
      }

      if (!visualProfile || typeof visualProfile !== 'object') {
        return res.status(400).json({
          error: 'INVALID_VISUAL_PROFILE',
          message: 'visualProfile must be a valid object',
          deployMarker: DEPLOY_TIMESTAMP
        })
      }

      logger.log("visual-profile", `📸 [${invocationId}] ${req.method} Visual Profile for project: ${projectId}`)

      // Validate required fields
      const requiredFields = [
        'color_palette_hex',
        'accent_colors_hex',
        'color_temperature',
        'lighting_style',
        'aspect_ratio',
        'lens_character',
        'film_stock_look',
        'post_processing',
        'composition_principles'
      ]

      for (const field of requiredFields) {
        if (!(field in visualProfile)) {
          return res.status(400).json({
            error: 'MISSING_REQUIRED_FIELD',
            message: `Visual Profile is missing required field: ${field}`,
            deployMarker: DEPLOY_TIMESTAMP
          })
        }
      }

      // Add timestamps
      const now = new Date().toISOString()
      const profileWithTimestamps: VisualProfile = {
        ...visualProfile,
        updated_at: now
      }

      // If creating new profile, add created_at
      if (!visualProfile.created_at) {
        profileWithTimestamps.created_at = now
      }

      // Update project with visual profile
      const result = await projectsCollection.updateOne(
        { _id: new ObjectId(projectId) },
        {
          $set: {
            visual_profile: profileWithTimestamps,
            updated_at: now
          }
        }
      )

      if (result.matchedCount === 0) {
        return res.status(404).json({
          error: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
          deployMarker: DEPLOY_TIMESTAMP
        })
      }

      logger.log("visual-profile", `✅ [${invocationId}] Visual Profile ${req.method === 'POST' ? 'created' : 'updated'} successfully`)

      return res.status(200).json({
        success: true,
        message: `Visual Profile ${req.method === 'POST' ? 'created' : 'updated'} successfully`,
        visual_profile: profileWithTimestamps,
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // DELETE: Remove Visual Profile from a project
    if (req.method === 'DELETE') {
      const { projectId } = req.query

      if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({
          error: 'MISSING_PROJECT_ID',
          message: 'projectId query parameter is required',
          deployMarker: DEPLOY_TIMESTAMP
        })
      }

      logger.log("visual-profile", `📸 [${invocationId}] DELETE Visual Profile for project: ${projectId}`)

      const result = await projectsCollection.updateOne(
        { _id: new ObjectId(projectId) },
        {
          $unset: { visual_profile: '' },
          $set: { updated_at: new Date().toISOString() }
        }
      )

      if (result.matchedCount === 0) {
        return res.status(404).json({
          error: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
          deployMarker: DEPLOY_TIMESTAMP
        })
      }

      logger.log("visual-profile", `✅ [${invocationId}] Visual Profile deleted successfully`)

      return res.status(200).json({
        success: true,
        message: 'Visual Profile deleted successfully',
        deployMarker: DEPLOY_TIMESTAMP
      })
    }

    // Method not allowed
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: `Method ${req.method} not allowed`,
      deployMarker: DEPLOY_TIMESTAMP
    })

  } catch (error) {
    logger.error("visual-profile", `❌ [${invocationId}] Error:`, error)
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      deployMarker: DEPLOY_TIMESTAMP
    })
  } finally {
    if (client) {
      await client.close()
    }
  }
}
