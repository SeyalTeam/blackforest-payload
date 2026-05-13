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
    
    // List all tables to see what we have
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `)
    console.log('Tables:', tables.rows.map(r => r.table_name))

    console.log('Dropping users_rels...')
    await client.query('DROP TABLE IF EXISTS "users_rels" CASCADE')
    console.log('Successfully dropped users_rels')

  } catch (err) {
    console.error('Error:', err)
  } finally {
    await client.end()
  }
}

run()
