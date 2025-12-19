import express from 'express';
import multer from 'multer';
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// This matches the exact URL the website is trying to talk to
app.post('/api/process-pdf', upload.single('file'), async (req, res) => {
  console.log("🚀 Bridge received PDF!");
  try {
    const fileData = req.file?.buffer.toString('base64');
    
    // This pushes the job into the Redis queue for the Worker to find
    await redis.lpush('pdf_queue', JSON.stringify({
      data: fileData,
      name: req.file?.originalname
    }));
    
    console.log("✅ PDF handed off to Worker.");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Bridge Error:", err);
    res.status(500).json({ error: "Bridge failed" });
  }
});

app.listen(3001, () => console.log("🏗️ Bridge Server listening on port 3001"));