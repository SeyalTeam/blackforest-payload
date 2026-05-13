import 'dotenv/config'
import mongoConfig from '../payload.mongo.config'
import { getPayload } from 'payload'
import fs from 'fs'
import path from 'path'

/**
 * MIGRATION EXPORT SCRIPT (READ-ONLY)
 * This script connects to the MongoDB database and exports a collection to JSON.
 * It does NOT modify or delete any data in MongoDB.
 */

const migrateExport = async () => {
  const slug = process.argv[2]
  if (!slug) {
    console.error('Please provide a collection slug (e.g., companies).')
    process.exit(1)
  }

  console.log(`[Export] Connecting to MongoDB to read "${slug}"...`)
  
  // Initialize Payload with MongoDB config
  const payload = await getPayload({ 
    config: mongoConfig,
  })
  
  try {
    // Check total count first
    const countResult = await payload.count({
      collection: slug as any,
      overrideAccess: true,
    })
    const totalDocs = countResult.totalDocs
    console.log(`[Export] Total documents available in MongoDB: ${totalDocs}`)

    let allDocs: any[] = []
    let page = 1
    const limit = 5000

    while (allDocs.length < totalDocs) {
      console.log(`[Export] Fetching page ${page} (${allDocs.length}/${totalDocs})...`)
      const result = await payload.find({
        collection: slug as any,
        limit: limit,
        page: page,
        depth: 0,
        overrideAccess: true,
      })
      allDocs = allDocs.concat(result.docs)
      if (result.docs.length < limit) break
      page++
    }

    const exportDir = path.join(process.cwd(), 'migration-data')
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir)

    const filePath = path.join(exportDir, `${slug}.json`)
    fs.writeFileSync(filePath, JSON.stringify(allDocs, null, 2))

    console.log(`[Export] Successfully read ${allDocs.length} documents. Saved to: migration-data/${slug}.json`)
  } catch (err) {
    console.error(`[Export] Error reading from MongoDB:`, err.message)
  }

  process.exit(0)
}

migrateExport()
