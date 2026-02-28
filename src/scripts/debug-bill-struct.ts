import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
dotenv.config()
const uri = process.env.DATABASE_URI
if (!uri) throw new Error('DATABASE_URI is not defined')
const client = new MongoClient(uri)
async function run() {
  await client.connect()
  const db = client.db('blackforest-payload')
  const bill = await db.collection('billings').findOne({ branch: '69724ad6f91273ae0b1e121f' })
  console.log('Bill with branch as string:', bill ? 'FOUND' : 'NOT FOUND')

  const bill2 = await db.collection('billings').findOne({})
  console.log('Sample bill structure:', JSON.stringify(bill2, null, 2))

  const recentBills = await db
    .collection('billings')
    .find({
      createdAt: { $gte: new Date('2026-02-26T00:00:00Z') },
    })
    .limit(5)
    .toArray()
  console.log(
    'Recent bills branches:',
    recentBills.map((b) => ({ id: b._id, branch: b.branch, date: b.createdAt })),
  )

  await client.close()
}
run()
