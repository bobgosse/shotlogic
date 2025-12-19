const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Body parser for API routes
app.use(express.json({ limit: '50mb' }));

// Import and mount API routes
const parseScreenplay = require('./api/parse-screenplay.ts');
const analyzeScene = require('./api/analyze-scene.ts');
const projectsGetAll = require('./api/projects/get-all.ts');
const projectsGetOne = require('./api/projects/get-one.ts');
const projectsSave = require('./api/projects/save.ts');
const projectsDelete = require('./api/projects/delete.ts');

// API Routes
app.use('/api/parse-screenplay', parseScreenplay);
app.use('/api/analyze-scene', analyzeScene);
app.use('/api/projects/get-all', projectsGetAll);
app.use('/api/projects/get-one', projectsGetOne);
app.use('/api/projects/save', projectsSave);
app.use('/api/projects/delete', projectsDelete);

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
