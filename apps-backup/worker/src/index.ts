import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import pdfParse from 'pdf-parse';
import { JSDOM } from 'jsdom';
import * as dotenv from 'dotenv';

dotenv.config();

// This is the "Magic Trick" that fixes the PDF crash
const dom = new JSDOM();
(global as any).DOMMatrix = dom.window.DOMMatrix;

// This connects to your Upstash Redis
const connection = new IORedis("rediss://default:AXBRAAIncDFjYjEwY2I5ZjU0NjY0OTU5OWY4MjE4ZDk2OGI2OWUzNHAxMjg3NTM@rapid-tomcat-28753.upstash.io:6379", {
  maxRetriesPerRequest: null,
});

const worker = new Worker('pdf-tasks', async (job) => {
  console.log(`💪 Muscle working on job: ${job.id}`);
  
  // Turn the file back into something the computer can read
  const buffer = Buffer.from(job.data.fileData, 'base64');
  
  // PDF Parsing that actually works now!
  const data = await pdfParse(buffer);
  
  console.log("✅ PDF read successfully. Sending text back to the Brain.");
  
  return {
    text: data.text,
    sceneCount: (data.text.match(/INT\.|EXT\./g) || []).length
  };
}, { connection });

console.log("🚀 The Worker Muscle is standing by...");