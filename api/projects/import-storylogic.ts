// api/projects/import-storylogic.ts
// Import StoryLogic JSON exports as new ShotLogic projects

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../lib/mongodb.js';
import { logger } from '../lib/logger';

interface StoryLogicScene {
  scene_number: number;
  scene_header: string;
  synopsis: string;
  story_context: {
    want: string;
    obstacle: string;
    conflict: string;
    turn: string;
    turnCause: string;
    stakes: string;
    change: string;
  };
}

interface StoryLogicExport {
  importedFrom: string;
  importedAt: string;
  title: string;
  scenes: StoryLogicScene[];
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { storyLogicData } = req.body;

    // Force userId from verified session — ignore any userId in the request body.
    const authUserId = (req as any).auth?.userId as string | undefined;
    if (!authUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const userId = authUserId;

    if (!storyLogicData) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'storyLogicData is required'
      });
    }

    const data = storyLogicData as StoryLogicExport;

    // Validate it's a StoryLogic export
    if (data.importedFrom !== 'StoryLogic') {
      return res.status(400).json({
        error: 'INVALID_FORMAT',
        message: 'File is not a StoryLogic export',
        userMessage: 'This JSON file is not a StoryLogic export. Please export from StoryLogic first.'
      });
    }

    if (!data.title || !Array.isArray(data.scenes) || data.scenes.length === 0) {
      return res.status(400).json({
        error: 'INVALID_FORMAT',
        message: 'StoryLogic export is missing title or scenes',
        userMessage: 'This StoryLogic export appears to be incomplete. It must contain a title and at least one scene.'
      });
    }

    logger.log('import-storylogic', `Importing "${data.title}" with ${data.scenes.length} scenes for user ${userId}`);

    // Map StoryLogic scenes to ShotLogic format
    const scenes = data.scenes.map((scene) => ({
      number: scene.scene_number,
      text: `${scene.scene_header}\n\n${scene.synopsis}`,
      analysis: null,
      status: 'PENDING',
      error: null,
      storyLogicContext: {
        synopsis: scene.synopsis,
        want: scene.story_context?.want || '',
        obstacle: scene.story_context?.obstacle || '',
        conflict: scene.story_context?.conflict || '',
        turn: scene.story_context?.turn || '',
        turnCause: scene.story_context?.turnCause || '',
        stakes: scene.story_context?.stakes || '',
        change: scene.story_context?.change || '',
      }
    }));

    const now = new Date();
    const projectToSave = {
      name: data.title,
      scenes,
      userId,
      createdAt: now,
      updatedAt: now,
      status: 'processing',
      importedFrom: 'StoryLogic',
      importedAt: data.importedAt || now.toISOString(),
    };

    const db = await getDb();
    const collection = db.collection('projects');
    const result = await collection.insertOne(projectToSave);

    logger.log('import-storylogic', `Project saved. ID: ${result.insertedId}`);

    return res.status(201).json({
      success: true,
      id: result.insertedId.toHexString(),
      message: `Imported "${data.title}" with ${scenes.length} scenes from StoryLogic`,
      scenesCount: scenes.length,
    });

  } catch (error) {
    logger.error('import-storylogic', 'Import error:', error);
    return res.status(500).json({
      error: 'IMPORT_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error',
      userMessage: 'Failed to import StoryLogic project. Please try again.'
    });
  }
}
