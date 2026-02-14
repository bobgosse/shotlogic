#!/usr/bin/env node
// Quick script to list all projects and their owners
// Run with: node scripts/list-projects.mjs

import { MongoClient } from 'mongodb';

const MONGODB_URI = "mongodb+srv://uncsa_admin:Newfoundland12@cluster0.vwbpzgt.mongodb.net/ShotLogicDB?appName=Cluster0";
const DB_NAME = 'ShotLogicDB';

async function main() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected!\n');

    const db = client.db(DB_NAME);
    const collection = db.collection('projects');

    const projects = await collection.find({}).toArray();

    console.log(`Found ${projects.length} projects:\n`);
    console.log('='.repeat(80));

    // Group by userId
    const byUser = {};
    for (const p of projects) {
      const userId = p.userId || 'NO_USER_ID (orphan)';
      if (!byUser[userId]) byUser[userId] = [];
      byUser[userId].push({
        id: p._id.toString(),
        name: p.name || 'Untitled',
        scenes: p.scenes?.length || 0,
        updatedAt: p.updatedAt
      });
    }

    // Print grouped
    for (const [userId, userProjects] of Object.entries(byUser)) {
      console.log(`\nUSER ID: ${userId}`);
      console.log('-'.repeat(60));
      for (const p of userProjects) {
        console.log(`  - "${p.name}" (${p.scenes} scenes)`);
        console.log(`    ID: ${p.id}`);
        console.log(`    Updated: ${p.updatedAt || 'unknown'}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\nTo find which email matches each userId, check your Clerk Dashboard:');
    console.log('https://dashboard.clerk.com/ → Users → Search by user ID');

  } finally {
    await client.close();
  }
}

main().catch(console.error);
