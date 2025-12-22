import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser for API routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS headers for API routes
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// API Routes - dynamically import TypeScript handlers
// CRITICAL FIX: Register tsx ONCE at startup, not on every request
let tsxRegistered = false;
const registerTsx = async () => {
  if (!tsxRegistered) {
    const { register } = await import('tsx/esm/api');
    register();
    tsxRegistered = true;
    console.log('✅ TypeScript runtime registered');
  }
};

// Call registration immediately
await registerTsx();

// API Routes - dynamically import TypeScript handlers  
const apiHandler = async (req, res, modulePath) => {
  try {
    const handler = await import(modulePath);
    await handler.default(req, res);
  } catch (error) {
    console.error(`API Error (${modulePath}):`, error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

// Parse screenplay endpoint
// Parse screenplay endpoint
app.post('/api/parse-screenplay', async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/parse-screenplay.ts'));
});

// Analyze scene endpoint
app.post('/api/analyze-scene', async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/analyze-scene.ts'));
});

// Project endpoints
app.get('/api/projects/get-all', async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/projects/get-all.ts'));
});

app.get('/api/projects/get-by-id', async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/projects/get-by-id.ts'));
});

app.get('/api/projects/get-one', async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/projects/get-one.ts'));
});

app.post('/api/projects/save', async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/projects/save.ts'));
});

app.delete('/api/projects/delete', async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/projects/delete.ts'));
});

// Serve static files
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback
app.use((req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ ShotLogic running on port ${PORT}`);
});
