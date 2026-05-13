import pg from 'pg'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config()

const MAPPING_FILE = path.join(process.cwd(), 'migration-data', 'id-mapping.json')

const loadMapping = () => {
  if (fs.existsSync(MAPPING_FILE)) {
    return JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'))
  }
  return {}
}

const saveMapping = (mapping: any) => {
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2))
}

const run = async () => {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URI,
  })

  const mapping = loadMapping()
  if (!mapping.media) mapping.media = {}

  try {
    await client.connect()
    console.log('Connected to database')

    const filePath = path.join(process.cwd(), 'migration-data', 'media.json')
    if (!fs.existsSync(filePath)) {
      console.error('media.json not found.')
      return
    }

    const docs = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    console.log(`Processing ${docs.length} media records...`)

    let successCount = 0
    let skipCount = 0

    for (const doc of docs) {
      if (mapping.media[doc.id]) {
        skipCount++
        continue
      }

      try {
        const query = `
          INSERT INTO "media" (
            filename, mime_type, filesize, width, height, url, alt, updated_at, created_at,
            sizes_thumbnail_filename, sizes_thumbnail_width, sizes_thumbnail_height, 
            sizes_thumbnail_mime_type, sizes_thumbnail_filesize, sizes_thumbnail_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id
        `
        const values = [
          doc.filename,
          doc.mimeType,
          doc.filesize,
          doc.width,
          doc.height,
          doc.url,
          doc.alt || '',
          doc.updatedAt,
          doc.createdAt,
          doc.sizes?.thumbnail?.filename || null,
          doc.sizes?.thumbnail?.width || null,
          doc.sizes?.thumbnail?.height || null,
          doc.sizes?.thumbnail?.mimeType || null,
          doc.sizes?.thumbnail?.filesize || null,
          doc.sizes?.thumbnail?.url || null
        ]

        const res = await client.query(query, values)
        mapping.media[doc.id] = res.rows[0].id
        successCount++

        if (successCount % 50 === 0) console.log(`Progress: ${successCount} imported...`)
      } catch (e) {
        console.error(`Failed to insert media ${doc.filename}:`, e.message)
      }
    }

    saveMapping(mapping)
    console.log(`Summary: Success ${successCount}, Skipped ${skipCount}`)

  } catch (err) {
    console.error('Error:', err)
  } finally {
    await client.end()
    process.exit(0)
  }
}

run()
