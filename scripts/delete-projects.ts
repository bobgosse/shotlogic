// scripts/delete-projects.ts
// One-time script to delete specific projects from MongoDB
// Run with: npx tsx scripts/delete-projects.ts

import { ObjectId } from 'mongodb'
import { getDb } from '../api/lib/mongodb.js'

const projectIdsToDelete = [
  '696639536e78cb445ff623db',
  '696639726e78cb445ff623dc',
  '69673c196e78cb445ff623dd',
]

async function deleteProjects() {
  try {
    const db = await getDb()
    const collection = db.collection('projects')

    console.log('✅ Connected to MongoDB')

    // First, show what we're about to delete
    console.log('\n📋 Projects to delete:')
    for (const id of projectIdsToDelete) {
      try {
        const project = await collection.findOne({ _id: new ObjectId(id) })
        if (project) {
          console.log(`  - ${id}: "${project.name || 'Untitled'}" (${project.scenes?.length || 0} scenes)`)
        } else {
          console.log(`  - ${id}: NOT FOUND`)
        }
      } catch (e) {
        console.log(`  - ${id}: INVALID ID FORMAT`)
      }
    }

    // Delete the projects
    console.log('\n🗑️  Deleting projects...')
    const objectIds = projectIdsToDelete.map(id => new ObjectId(id))
    const result = await collection.deleteMany({ _id: { $in: objectIds } })

    console.log(`✅ Deleted ${result.deletedCount} project(s)`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }

  // Exit cleanly (MongoDB connection is cached globally)
  process.exit(0)
}

deleteProjects()
