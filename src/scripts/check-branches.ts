import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
dotenv.config()
const uri = process.env.DATABASE_URI
if (!uri) throw new Error('DATABASE_URI is not defined')
const client = new MongoClient(uri)
async function run() {
  await client.connect()
  const db = client.db('blackforest-payload')
  const branches = await db.collection('branches').find({}).toArray()
  console.log(
    'Branches:',
    JSON.stringify(
      branches.map((b) => ({ id: b._id, name: b.name })),
      null,
      2,
    ),
  )

  const targetBranch = branches.find((b) => b._id.toString() === '69724ad6f91273ae0b1e121f')
  console.log('Target Branch Match:', targetBranch ? targetBranch.name : 'NONE FOUND')

  const count = await db.collection('billings').countDocuments()
  console.log('Total Billings in DB:', count)

  await client.close()
}
run()
