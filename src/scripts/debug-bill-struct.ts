import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
dotenv.config()
const client = new MongoClient(process.env.DATABASE_URI)
async function run() {
  await client.connect()
  const db = client.db('blackforest-payload')
  const bill = await db.collection('billings').findOne({ branch: '69724ad6f91273ae0b1e121f' })
  console.log('Bill with branch as string:', bill ? 'FOUND' : 'NOT FOUND')

  const bill2 = await db.collection('billings').findOne({})
  console.log('Sample bill structure:', JSON.stringify(bill2, null, 2))

  // Try finding by branch since yesterday without string match
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
