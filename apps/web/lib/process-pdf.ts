import { pdfQueue } from '../lib/queue';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileData, fileName } = req.body;

    // We take the "Base64" (the computer-code version of the file) 
    // and send it to the Muscle via the Queue
    const job = await pdfQueue.add('extract-screenplay', {
      fileData,
      fileName,
    });

    // We tell the website: "Okay, we're working on it! Here is the ID card for this task."
    res.status(202).json({ 
      jobId: job.id,
      message: 'Processing started' 
    });
  } catch (error) {
    console.error('Queue error:', error);
    res.status(500).json({ error: 'Failed to start processing' });
  }
}