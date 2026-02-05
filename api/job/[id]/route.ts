import { NextRequest, NextResponse } from 'next/server';
import { pdfQueue } from '../../lib/queue';
import { logger } from "../../lib/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  try {
    // We ask the Queue for the specific job using its ID
    const job = await pdfQueue.getJob(id);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check the current state (active, completed, failed, etc.)
    const state = await job.getState();
    const result = job.returnvalue;

    return NextResponse.json({
      id: job.id,
      state,
      progress: job.progress,
      result: result || null
    });
  } catch (error) {
    logger.error("route", 'Polling error:', error);
    return NextResponse.json({ error: 'Failed to fetch job status' }, { status: 500 });
  }
}