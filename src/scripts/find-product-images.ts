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
    const mediaIds: any[] = []
    targetProducts.forEach((p) => {
      if (p.images && Array.isArray(p.images)) {
        p.images.forEach((imgObj) => {
          if (imgObj.image) mediaIds.push(imgObj.image)
        })
      }
    })

    if (mediaIds.length === 0) {
      console.log('No images found for EGG PUFFS or DUBAI CHOCO KUNAFA')
      return
    }

    // Lookup media documents
    const mediaColl = db.collection('media')
    const medias = await mediaColl.find({ _id: { $in: mediaIds } }).toArray()

    console.log('--- Image URLs ---')
    targetProducts.forEach((p) => {
      console.log(`\nProduct: ${p.name}`)
      if (!p.images || p.images.length === 0) {
        console.log('  No images configured')
        return
      }
      p.images.forEach((imgObj, index) => {
        const mediaId = imgObj.image.toString()
        const mediaDoc = medias.find((m) => m._id.toString() === mediaId)
        if (mediaDoc) {
          console.log(`  Image ${index + 1}:`)
          console.log(`    Filename: ${mediaDoc.filename}`)
          console.log(`    URL: ${mediaDoc.url}`)
          // Vercel Blob adapter usually sets the .url property
        } else {
          console.log(`  Image ${index + 1}: Media document not found (ID: ${mediaId})`)
        }
      })
    })
  } catch (err) {
    console.error(err)
  } finally {
    await client.close()
  }
}

run().catch(console.error)
