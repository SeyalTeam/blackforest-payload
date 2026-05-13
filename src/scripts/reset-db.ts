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
    
    console.log('Dropping public schema...')
    await client.query('DROP SCHEMA public CASCADE')
    console.log('Recreating public schema...')
    await client.query('CREATE SCHEMA public')
    await client.query('GRANT ALL ON SCHEMA public TO public')
    await client.query('GRANT ALL ON SCHEMA public TO postgres')
    
    console.log('Successfully reset database schema')

  } catch (err) {
    console.error('Error:', err)
  } finally {
    await client.end()
  }
}

run()
