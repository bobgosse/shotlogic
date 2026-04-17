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
// The verify callback preserves the raw body for webhook signature verification
app.use(express.json({
  limit: '50mb',
  verify: (req, _res, buf) => {
    if (req.url.startsWith('/api/webhook/')) {
      req.rawBody = buf.toString('utf8');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS headers for API routes
const ALLOWED_ORIGINS = (() => {
  const origins = [
    process.env.ALLOWED_ORIGIN || 'https://shotlogic.studio',
    'https://www.shotlogic.studio',
    'https://shotlogic.studio'
  ];
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:5173', 'http://localhost:3000');
  }
  return [...new Set(origins)];
})();

app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  res.header('Access-Control-Allow-Credentials', 'true');
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

// Import auth / rate-limit middleware (tsx-registered so .ts imports resolve)
const { requireAuth } = await import(join(__dirname, 'api/lib/requireAuth.ts'));
const { requireApiKey } = await import(join(__dirname, 'api/lib/requireApiKey.ts'));
const { aiIpLimiter, aiUserLimiter } = await import(join(__dirname, 'api/lib/rateLimit.ts'));

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

// Parse screenplay endpoint (local parsing, no AI calls — auth + rate limit per spec)
app.post('/api/parse-screenplay', aiIpLimiter, requireAuth, aiUserLimiter, async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/parse-screenplay.ts'));
});

// Analyze scene endpoint (Anthropic — full rate-limit chain)
app.post('/api/analyze-scene', aiIpLimiter, requireAuth, aiUserLimiter, async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/analyze-scene.ts'));
});

// Analyze scene status endpoint (polling)
app.get('/api/analyze-scene-status', requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/analyze-scene-status.ts'));
});

// Project endpoints (all require session; handler enforces ownership)
app.get('/api/projects/get-all', requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/projects/get-all.ts'));
});

app.get('/api/projects/get-by-id', requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/projects/get-by-id.ts'));
});

app.get('/api/projects/get-one', requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/projects/get-one.ts'));
});

app.post('/api/projects/save', requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/projects/save.ts'));
});

app.delete('/api/projects/delete', requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/projects/delete.ts'));
});
app.patch('/api/projects/rename', requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/projects/rename.ts'));
});
app.post('/api/projects/claim-orphans', requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, 'api/projects/claim-orphans.ts'));
});

app.post("/api/projects/save-scene", requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/projects/save-scene.ts"));
});

app.post("/api/projects/update-style", requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/projects/update-style.ts"));
});

app.post("/api/projects/update-characters", requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/projects/update-characters.ts"));
});

app.post("/api/projects/update-scene-analysis", requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/projects/update-scene-analysis.ts"));
});

app.post("/api/projects/update-scene-status", requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/projects/update-scene-status.ts"));
});

app.post("/api/projects/import-storylogic", requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/projects/import-storylogic.ts"));
});

// Admin endpoints (X-API-Key)
app.get("/api/admin/analysis-health", requireApiKey, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/admin/analysis-health.ts"));
});
app.delete("/api/admin/delete-project", requireApiKey, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/admin/delete-project.ts"));
});
app.post("/api/admin/reset-project-status", requireApiKey, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/admin/reset-project-status.ts"));
});
app.post("/api/admin/reassign-projects", requireApiKey, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/admin/reassign-projects.ts"));
});
app.get("/api/admin/reassign-projects", requireApiKey, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/admin/reassign-projects.ts"));
});
app.get("/api/admin/list-all-projects", requireApiKey, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/admin/list-all-projects.ts"));
});
// Admin: List all users with activity (keeps existing in-handler admin allowlist check)
app.get("/api/admin/users", requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/admin/users.ts"));
});

// Visual profile endpoint
app.post("/api/visual-profile", requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/visual-profile.ts"));
});

// Credits endpoints (session required; handler reads req.auth.userId)
app.get("/api/credits/get-balance", requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/credits/get-balance.ts"));
});

app.post("/api/credits/create-checkout", requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/credits/create-checkout.ts"));
});

// Stripe webhook
app.post("/api/webhook/stripe", async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/webhook/stripe.ts"));
});

// Clerk webhook (user.created notifications)
app.post("/api/webhook/clerk", async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/webhook/clerk.ts"));
});

// User onboarding (session required; handler reads req.auth.userId)
app.get("/api/user/onboarding", requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/user/onboarding.ts"));
});
app.post("/api/user/onboarding", requireAuth, async (req, res) => {
  await apiHandler(req, res, join(__dirname, "api/user/onboarding.ts"));
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
