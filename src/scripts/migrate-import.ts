import 'dotenv/config'
import { getPayload } from 'payload'
import fs from 'fs'
import path from 'path'

/**
 * MIGRATION IMPORT SCRIPT WITH ID MAPPING
 * This script reads JSON data and inserts it into PostgreSQL.
 * It maps MongoDB String IDs to PostgreSQL Integer IDs.
 */

const MAPPING_FILE = path.join(process.cwd(), 'migration-data', 'id-mapping.json')

const loadMapping = () => {
  if (fs.existsSync(MAPPING_FILE)) {
    return JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'))
  }
  return {}
}

const saveMapping = (mapping: Record<string, Record<string, string>>) => {
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2))
}

const migrateImport = async () => {
  const slug = process.argv[2]
  if (!slug) {
    console.error('Please provide a collection slug (e.g., companies).')
    process.exit(1)
  }

  const mapping = loadMapping()
  if (!mapping[slug]) mapping[slug] = {}

  if (!process.env.PAYLOAD_DB_MODE) {
    process.env.PAYLOAD_DB_MODE = 'postgres'
  }

  const { default: configPromise } = await import('../payload.config')

  console.log(`[Import] Initializing Payload for PostgreSQL...`)
  console.log(`[Import] Effective PAYLOAD_DB_MODE: ${process.env.PAYLOAD_DB_MODE}`)
  const payload = await getPayload({ 
    config: await configPromise,
  })

  const filePath = path.join(process.cwd(), 'migration-data', `${slug}.json`)
  if (!fs.existsSync(filePath)) {
    console.error(`[Import] File not found: ${filePath}. Run export first.`)
    process.exit(1)
  }

  const docs = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  console.log(`[Import] Processing ${docs.length} documents for "${slug}"...`)

  let successCount = 0
  let skipCount = 0
  let failCount = 0

  for (const doc of docs) {
    try {
      const mongoId = doc.id
      
      // Check if already mapped
      if (mapping[slug][mongoId]) {
        console.log(`[Import] Skipping already mapped ID: ${mongoId}`)
        skipCount++
        continue
      }

      // 1. Prepare data (Clean up Mongo specific fields and map relationships)
      const data = { ...doc }
      delete data.id
      delete data.createdAt
      delete data.updatedAt
      delete data.__v

      // 2. Map Relationships (Simplified: look for string IDs that match our mapping)
      // This is a recursive function to find and replace IDs
      const mapRelationships = (obj: any) => {
        if (!obj || typeof obj !== 'object') return
        
        for (const key in obj) {
          const value = obj[key]
          
          if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
            // It looks like a MongoDB ID. Check all mappings.
            let mapped = false
            for (const otherSlug in mapping) {
              if (mapping[otherSlug][value]) {
                obj[key] = mapping[otherSlug][value]
                mapped = true
                break
              }
            }
            if (!mapped) {
              console.warn(`[Import] Warning: Unmapped Mongo ID found: ${value} in field ${key}. Removing it.`)
              delete obj[key]
            }
          } else if (Array.isArray(value)) {
            const newArray: any[] = []
            value.forEach((item) => {
              if (typeof item === 'string' && /^[0-9a-fA-F]{24}$/.test(item)) {
                let mapped = false
                for (const otherSlug in mapping) {
                  if (mapping[otherSlug][item]) {
                    newArray.push(mapping[otherSlug][item])
                    mapped = true
                    break
                  }
                }
                if (!mapped) {
                  console.warn(`[Import] Warning: Unmapped Mongo ID in array: ${item} in field ${key}. Skipping item.`)
                }
              } else if (typeof item === 'object' && item !== null) {
                if (item.id && /^[0-9a-fA-F]{24}$/.test(item.id)) {
                  delete item.id // Delete old Mongo row ID, Payload will generate new ones
                }
                newArray.push(item)
                mapRelationships(item)
              } else {
                newArray.push(item)
              }
            })
            obj[key] = newArray
          } else if (typeof value === 'object' && value !== null) {
             if (value.id && /^[0-9a-fA-F]{24}$/.test(value.id)) {
                delete value.id
             }
             mapRelationships(value)
          }
        }
      }

      mapRelationships(data)

      if (successCount < 5) {
        console.log(`[Import] Debug Data for ID ${doc.id}:`, JSON.stringify(data, null, 2))
      }

      // Special handling for dealers: Extract PAN from GST and handle empty bank details
      if (slug === 'dealers') {
        if (data.isGSTRegistered && data.gst && !data.pan) {
          if (data.gst.length >= 12) {
            data.pan = data.gst.substring(2, 12)
          }
        }
        if (data.hasBankAccount && (!data.bankDetails || Object.keys(data.bankDetails).length === 0)) {
          data.hasBankAccount = false
          delete data.bankDetails
        }
        
        // Fill missing required fields
        data.address = data.address || 'N/A'
        data.phoneNumber = data.phoneNumber || '0000000000'
        data.email = data.email || 'dealer@example.com'
        data.contactPerson = data.contactPerson || {}
        data.contactPerson.name = data.contactPerson.name || 'Unknown'
      }

      // 3. Create in Postgres
      const newDoc = await payload.create({
        collection: slug as any,
        data: data,
        overrideAccess: true,
        req: {
          user: {
            id: 'system',
            role: 'superadmin',
          },
        } as any,
      })

      // 4. Record the mapping
      mapping[slug][mongoId] = newDoc.id
      successCount++
      
      if (successCount % 10 === 0) {
        console.log(`[Import] Progress: ${successCount} imported...`)
        saveMapping(mapping) // Save progress periodically
      }
    } catch (err) {
      console.error(`[Import] Failed for Mongo ID ${doc.id}:`, err.message)
      failCount++
    }
  }

  saveMapping(mapping)
  console.log(`[Import] Summary for "${slug}":`)
  console.log(` - Success: ${successCount}`)
  console.log(` - Skipped: ${skipCount}`)
  console.log(` - Failed:  ${failCount}`)
  
  process.exit(0)
}

migrateImport()
