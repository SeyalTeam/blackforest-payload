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
    
    const res = await client.query(`
      SELECT id, name FROM products WHERE name = 'Legacy/Deleted Product'
    `)
    console.log('Legacy Product:', res.rows)
    
  } catch (err) {
    console.error('Error:', err)
  } finally {
    await client.end()
  }
}

run()
