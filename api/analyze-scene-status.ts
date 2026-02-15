// api/analyze-scene-status.ts
// Poll endpoint for async job status

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getJobStatus } from './lib/analysisJobs.js';
import { logger } from './lib/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { jobId } = req.query;

    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({ error: 'jobId is required' });
    }

    logger.log('analyze-scene-status', `📊 Checking status for job ${jobId}`);

    const job = await getJobStatus(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Return job status
    return res.status(200).json({
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
    });
  } catch (error: any) {
    logger.error('analyze-scene-status', 'Error checking job status:', error);
    return res.status(500).json({ error: error.message || 'Failed to check job status' });
  }
}
