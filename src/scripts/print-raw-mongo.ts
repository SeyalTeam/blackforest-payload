import config from '../payload.config'
import { getPayload } from 'payload'
import mongoose from 'mongoose'

const printRawMongo = async () => {
  const payload = await getPayload({ config })

  console.log('Querying raw MongoDB document for tables collection...')
  const db = (mongoose.connection as any).db
  if (!db) {
    console.log('No mongoose connection found.')
    process.exit(1)
  }

  const collections = await db.listCollections().toArray()
  console.log('Collections in database:', collections.map((c: any) => c.name))

  const tablesCollection = db.collection('tables')
  const docs = await tablesCollection.find({}).toArray()
  console.log('Raw MongoDB documents in tables:')
  console.log(JSON.stringify(docs, null, 2))

  process.exit(0)
}

printRawMongo()
