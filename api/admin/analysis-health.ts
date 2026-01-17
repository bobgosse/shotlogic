// api/admin/analysis-health.ts
// Health check endpoint for monitoring analysis quality
// Hit /api/admin/analysis-health to see status of recent projects

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/mongodb.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const db = await getDb()
    const collection = db.collection('projects')

    // Get projects from last 7 days
    // Check both createdAt and updatedAt since some projects may not have createdAt
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    // First try to get recent projects by date, then fall back to all projects (limited)
    let recentProjects = await collection.find({
      $or: [
        { createdAt: { $gte: oneWeekAgo } },
        { updatedAt: { $gte: oneWeekAgo } }
      ]
    }).toArray()

    // If no projects found with date filter, get the most recent 20 projects
    if (recentProjects.length === 0) {
      recentProjects = await collection.find({})
        .sort({ _id: -1 }) // Sort by ObjectId descending (newest first)
        .limit(20)
        .toArray()
    }

    const issues: any[] = []
    let totalScenes = 0
    let healthyScenes = 0

    for (const project of recentProjects) {
      for (const scene of (project.scenes || [])) {
        totalScenes++

        // Skip scenes that haven't been analyzed
        if (!scene.analysis || scene.status === 'pending') continue

        const sceneIssues: string[] = []

        // Check format
        if (typeof scene.analysis !== 'string') {
          sceneIssues.push('wrong format (not string)')
        } else {
          try {
            const parsed = JSON.parse(scene.analysis)

            // Check story fields
            if (!parsed.story_analysis?.the_core || parsed.story_analysis.the_core.length < 20) {
              sceneIssues.push('the_core empty')
            }
            if (!parsed.story_analysis?.the_turn || parsed.story_analysis.the_turn.length < 20) {
              sceneIssues.push('the_turn empty')
            }

            // Check producing fields
            if (!parsed.producing_logistics?.locations) {
              sceneIssues.push('locations missing')
            }

            // Check subtext and conflict (stored in story_analysis, not directing_vision)
            if (!parsed.story_analysis?.subtext) {
              sceneIssues.push('subtext missing')
            }
            if (!parsed.story_analysis?.conflict) {
              sceneIssues.push('conflict missing')
            }

            // Check shots
            if (!parsed.shot_list || parsed.shot_list.length === 0) {
              sceneIssues.push('no shots')
            }

          } catch (e) {
            sceneIssues.push('invalid JSON')
          }
        }

        if (sceneIssues.length > 0) {
          issues.push({
            projectId: project._id.toString(),
            projectTitle: project.name || project.title || 'Untitled',
            sceneNumber: scene.number,
            issues: sceneIssues
          })
        } else {
          healthyScenes++
        }
      }
    }

    const healthPercentage = totalScenes > 0 ? Math.round((healthyScenes / totalScenes) * 100) : 100

    return res.status(200).json({
      status: healthPercentage >= 90 ? 'HEALTHY' : healthPercentage >= 70 ? 'DEGRADED' : 'CRITICAL',
      summary: {
        projectsScanned: recentProjects.length,
        totalScenes,
        healthyScenes,
        issueCount: issues.length,
        healthPercentage: `${healthPercentage}%`
      },
      issues: issues.slice(0, 50), // Limit to first 50 issues
      checkedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Health check error:', error)
    return res.status(500).json({
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
