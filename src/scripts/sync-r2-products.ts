import 'dotenv/config'
import { getPayload } from 'payload'
import configPromise from '../payload.config'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const run = async () => {
  console.log('--- R2 Sync Started (Payload DB Adapter Mode) ---')

  const payload = await getPayload({ config: configPromise })
  console.log('Payload initialized.')

  // In Payload 3.x, the adapter's collections are models or table-like objects
  // For MongoDB, payload.db.collections['media'] is likely the mongoose model or a wrapper
  console.log(
    'Available collections in adapter:',
    Object.keys((payload.db as any).collections || {}),
  )

  const MediaModel = (payload.db as any).collections['media']
  if (!MediaModel) {
    console.error('Media collection not found in DB adapter!')
    process.exit(1)
  }

  const s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true,
  })

  const BUCKET = process.env.S3_BUCKET || ''
  const ROOT_PREFIX = 'blackforest/uploads/'
  const PRODUCTS_SUBFOLDER = 'products/'
  const FULL_PREFIX = ROOT_PREFIX + PRODUCTS_SUBFOLDER

  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: FULL_PREFIX,
    })

    const data = await s3Client.send(command)
    const contents = data.Contents || []

    console.log(`Found ${contents.length} objects in R2.`)

    for (const object of contents) {
      const key = object.Key
      if (!key || key === FULL_PREFIX) continue

      const justFilename = key.split('/').pop() || ''
      if (!justFilename) continue

      const dbFilename = justFilename

      // 1. Check if Media exists in Payload via standard Payload API (fast)
      let existingMedia = await payload.find({
        collection: 'media',
        where: { filename: { equals: dbFilename } },
        limit: 1,
      })
      if (existingMedia.docs.length === 0) {
        existingMedia = await payload.find({
          collection: 'media',
          where: { filename: { equals: `products/${justFilename}` } },
          limit: 1,
        })
      }

      let mediaId
      if (existingMedia.docs.length === 0) {
        console.log(`Syncing ${dbFilename}...`)

        // Directly create in MongoDB using the adapter's model
        // For Mongoose adapter, it's a model so we use .create()
        const doc = await MediaModel.create({
          filename: dbFilename,
          prefix: 'products/',
          mimeType: justFilename.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
          filesize: object.Size || 0,
          width: 400,
          height: 300,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        mediaId = (doc.id || doc._id).toString()
        console.log(`Created Media ID: ${mediaId}`)
      } else {
        mediaId = existingMedia.docs[0].id
        console.log(`Media exists: ${mediaId}`)
      }

      // 2. Link to Product
      const stem = justFilename.split('.').slice(0, -1).join('.')
      const normalizedStem = stem.replace(/-400x300$/, '').trim()

      const products = await payload.find({
        collection: 'products',
        where: {
          or: [{ name: { equals: normalizedStem } }, { name: { equals: stem } }],
        },
      })

      if (products.docs.length > 0) {
        const product = products.docs[0]
        const isLinked = product.images?.some((img) =>
          typeof img.image === 'object' ? (img.image as any).id === mediaId : img.image === mediaId,
        )

        if (!isLinked) {
          console.log(`Linking ${justFilename} to product: ${product.name}`)
          await payload.update({
            collection: 'products',
            id: product.id,
            data: {
              images: [...(product.images || []), { image: mediaId }],
            },
          })
        }
      }
    }
  } catch (err) {
    console.error('Error:', err)
  }

  console.log('--- Finished ---')
  process.exit(0)
}

run()
