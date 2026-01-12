// scripts/clear-all-projects.ts
// WARNING: This deletes ALL projects from MongoDB
// Use this to clean up broken test data before production

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set');
  process.exit(1);
}

async function clearAllProjects() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db('shotlogic');
    const collection = db.collection('projects');

    // Get count before deletion
    const countBefore = await collection.countDocuments();
    console.log(`📊 Found ${countBefore} projects in database`);

    if (countBefore === 0) {
      console.log('✅ Database is already empty');
      return;
    }

    // Confirm deletion
    console.log('⚠️  WARNING: About to DELETE ALL PROJECTS');
    console.log('⚠️  Press Ctrl+C now to cancel, or wait 5 seconds to proceed...');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete all projects
    const result = await collection.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} projects`);

    // Verify
    const countAfter = await collection.countDocuments();
    console.log(`📊 Projects remaining: ${countAfter}`);

    if (countAfter === 0) {
      console.log('✅ Database cleared successfully');
    } else {
      console.log('⚠️  Warning: Some projects may remain');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('✅ Disconnected from MongoDB');
  }
}

clearAllProjects();
