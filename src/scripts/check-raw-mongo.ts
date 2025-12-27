import { getPayload } from 'payload'
import config from '../payload.config'

const run = async () => {
  const payload = await getPayload({ config })

  // Access raw Mongo driver
  const rawCollection = payload.db.collections['closing-entries'].collection
  const doc = await rawCollection.findOne({})

  if (doc) {
    console.log('Raw Mongo Doc Date:', doc.date)
    console.log('Type:', Object.prototype.toString.call(doc.date)) // [object Date] vs [object String]
  } else {
    console.log('No document found')
  }

  process.exit(0)
}

run()
