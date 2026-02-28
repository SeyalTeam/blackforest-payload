import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
dotenv.config()

const uri = process.env.DATABASE_URI
if (!uri) throw new Error('DATABASE_URI is not defined')

const client = new MongoClient(uri)

async function run() {
  try {
    await client.connect()
    const db = client.db('blackforest-payload')

    // Find products
    const productsColl = db.collection('products')
    const targetProducts = await productsColl
      .find({
        name: { $in: ['EGG PUFFS', 'DUBAI CHOCO KUNAFA'] },
      })
      .toArray()

    // Get media IDs
    const mediaIds = targetProducts.flatMap((p) =>
      Array.isArray(p.images) ? p.images.map((i) => i.image).filter(Boolean) : [],
    )

    const mediaColl = db.collection('media')
    const medias = await mediaColl.find({ _id: { $in: mediaIds } }).toArray()

    console.log('--- Media Documents ---')
    console.log(JSON.stringify(medias, null, 2))
  } catch (err) {
    console.error(err)
  } finally {
    await client.close()
  }
}

run().catch(console.error)
