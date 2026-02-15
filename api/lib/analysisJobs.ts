// api/lib/analysisJobs.ts
// Analysis job management for async scene analysis with polling

import { getDb } from './mongodb.js';
import { logger } from './logger.js';

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';

export interface AnalysisJob {
  jobId: string;
  userId: string;
  projectId?: string;
  sceneNumber: number;
  sceneText: string;
  totalScenes: number;
  visualStyle?: string | null;
  visualProfile?: any;
  characters?: Array<{ name: string; physical: string }>;
  customInstructions?: string;
  status: JobStatus;
  progress?: {
    phase: 'story' | 'producing' | 'directing' | 'complete';
    message: string;
  };
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * Create a new analysis job
 */
export async function createAnalysisJob(jobData: {
  userId: string;
  projectId?: string;
  sceneNumber: number;
  sceneText: string;
  totalScenes: number;
  visualStyle?: string | null;
  visualProfile?: any;
  characters?: Array<{ name: string; physical: string }>;
  customInstructions?: string;
}): Promise<string> {
  try {
    const db = await getDb();
    const jobs = db.collection<AnalysisJob>('analysisJobs');
    
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    const job: AnalysisJob = {
      jobId,
      ...jobData,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await jobs.insertOne(job as any);
    
    logger.log('analysisJobs', `✅ Created job ${jobId} for scene ${jobData.sceneNumber}`);
    
    return jobId;
  } catch (error) {
    logger.error('analysisJobs', 'Failed to create analysis job:', error);
    throw new Error('Failed to create analysis job');
  }
}

/**
 * Get job status and result
 */
export async function getJobStatus(jobId: string): Promise<AnalysisJob | null> {
  try {
    const db = await getDb();
    const jobs = db.collection<AnalysisJob>('analysisJobs');
    
    const job = await jobs.findOne({ jobId });
    
    return job;
  } catch (error) {
    logger.error('analysisJobs', `Failed to get job status for ${jobId}:`, error);
    return null;
  }
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  progress?: { phase: 'story' | 'producing' | 'directing' | 'complete'; message: string },
  result?: any,
  error?: string
): Promise<void> {
  try {
    const db = await getDb();
    const jobs = db.collection<AnalysisJob>('analysisJobs');
    
    const update: any = {
      status,
      updatedAt: new Date(),
    };
    
    if (progress) {
      update.progress = progress;
    }
    
    if (result) {
      update.result = result;
      update.completedAt = new Date();
    }
    
    if (error) {
      update.error = error;
    }
    
    await jobs.updateOne(
      { jobId },
      { $set: update }
    );
    
    logger.log('analysisJobs', `📝 Updated job ${jobId} to ${status}`);
  } catch (error) {
    logger.error('analysisJobs', `Failed to update job ${jobId}:`, error);
    // Don't throw - let the analysis continue even if logging fails
  }
}

/**
 * Start processing a job (background execution)
 */
export async function startJobProcessing(jobId: string): Promise<void> {
  await updateJobStatus(jobId, 'PROCESSING', {
    phase: 'story',
    message: 'Starting story analysis...'
  });
}

/**
 * Mark job as completed with result
 */
export async function completeJob(jobId: string, result: any): Promise<void> {
  await updateJobStatus(jobId, 'COMPLETED', {
    phase: 'complete',
    message: 'Analysis complete'
  }, result);
}

/**
 * Mark job as failed with error
 */
export async function failJob(jobId: string, error: string): Promise<void> {
  await updateJobStatus(jobId, 'ERROR', undefined, undefined, error);
}
