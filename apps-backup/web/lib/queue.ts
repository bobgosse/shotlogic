import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// This connects to the same Redis "telephone exchange" as the worker
const connection = new IORedis("rediss://default:AXBRAAIncDFjYjEwY2I5ZjU0NjY0OTU5OWY4MjE4ZDk2OGI2OWUzNHAxMjg3NTM@rapid-tomcat-28753.upstash.io:6379", {
  maxRetriesPerRequest: null,
});

export const pdfQueue = new Queue('pdf-tasks', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});