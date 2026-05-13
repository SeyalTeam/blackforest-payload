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
  if (!mapping.users) mapping.users = {}

  try {
    await client.connect()
    console.log('Connected to database')

    const filePath = path.join(process.cwd(), 'migration-data', 'users.json')
    if (!fs.existsSync(filePath)) {
      console.error('users.json not found.')
      return
    }

    const docs = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    console.log(`Processing ${docs.length} user records...`)

    let successCount = 0
    let skipCount = 0

    for (const doc of docs) {
      if (mapping.users[doc.id]) {
        skipCount++
        continue
      }

      try {
        // Map relationship fields
        const branchId = doc.branch ? mapping.branches?.[doc.branch] || null : null
        const companyId = doc.company ? mapping.companies?.[doc.company] || null : null
        // employee relationship mapping would go here if needed
        
        const query = `
          INSERT INTO "users" (
            email, name, role, hash, salt, branch_id, company_id, 
            is_kitchen, is_stock, login_blocked, force_logout_all_devices,
            updated_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id
        `
        const values = [
          doc.email,
          doc.name || '',
          doc.role || 'admin',
          doc.hash || '',
          doc.salt || '',
          branchId,
          companyId,
          doc.isKitchen || false,
          doc.isStock || false,
          doc.loginBlocked || false,
          doc.forceLogoutAllDevices || false,
          doc.updatedAt,
          doc.createdAt
        ]

        const res = await client.query(query, values)
        const newId = res.rows[0].id
        mapping.users[doc.id] = newId
        
        // Handle hasMany relationships (kitchenBranches, kitchen)
        if (doc.kitchenBranches && Array.isArray(doc.kitchenBranches)) {
          for (const branchMongoId of doc.kitchenBranches) {
            const mappedBranchId = mapping.branches?.[branchMongoId]
            if (mappedBranchId) {
              await client.query(
                'INSERT INTO users_rels (parent_id, path, branches_id) VALUES ($1, $2, $3)',
                [newId, 'kitchenBranches', mappedBranchId]
              )
            }
          }
        }

        if (doc.kitchen && Array.isArray(doc.kitchen)) {
          for (const kitchenMongoId of doc.kitchen) {
            const mappedKitchenId = mapping.kitchens?.[kitchenMongoId]
            if (mappedKitchenId) {
              await client.query(
                'INSERT INTO users_rels (parent_id, path, kitchens_id) VALUES ($1, $2, $3)',
                [newId, 'kitchen', mappedKitchenId]
              )
            }
          }
        }

        successCount++
      } catch (e) {
        console.error(`Failed to insert user ${doc.email}:`, e.message)
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
