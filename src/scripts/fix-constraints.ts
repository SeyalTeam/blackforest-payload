import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const run = async () => {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URI,
  })

  try {
    await client.connect()
    console.log('Connected to database')
    
    const tables = ['users_rels', 'categories', 'products_branch_overrides', 'departments_rels']
    
    for (const table of tables) {
      console.log(`Checking table: ${table}`)
      try {
        // Find constraints on the 'id' column of the table
        const res = await client.query(`
          SELECT constraint_name 
          FROM information_schema.constraint_column_usage 
          WHERE table_name = $1 AND column_name = 'id'
        `, [table])
        
        for (const row of res.rows) {
          const constraint = row.constraint_name
          console.log(`Found constraint ${constraint} on ${table}.id`)
          if (constraint.includes('_id_not_null') || constraint.includes('_not_null')) {
            console.log(`Dropping constraint ${constraint}...`)
            await client.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${constraint}"`)
          }
        }
      } catch (e) {
        console.error(`Error processing ${table}:`, e.message)
      }
    }

  } catch (err) {
    console.error('Error:', err)
  } finally {
    await client.end()
  }
}

run()
