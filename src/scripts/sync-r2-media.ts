import 'dotenv/config'
import { getPayload } from 'payload'
import configPromise from '../payload.config'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const run = async () => {
  const args = process.argv.slice(2)
  const folder = args[0] || 'products'

  console.log(`--- R2 Sync Started: ${folder} ---`)

  const payload = await getPayload({ config: configPromise })
  const db = payload.db as any
  const MediaModel = db.collections['media']
  const ProductModel = db.collections['products']
  const CategoryModel = db.collections['categories']

  if (!MediaModel) {
    console.error('Media model not found in Payload adapter.')
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
  const FULL_PREFIX = `${ROOT_PREFIX}${folder}/`

  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: FULL_PREFIX,
    })

    const data = await s3Client.send(command)
    const contents = data.Contents || []

    console.log(`Found ${contents.length} objects in R2 under ${FULL_PREFIX}.`)

    for (const object of contents) {
      const key = object.Key
      if (!key || key === FULL_PREFIX) continue

      const justFilename = key.split('/').pop() || ''
      if (!justFilename) continue

      const dbFilename = `${folder}/${justFilename}`

      // 1. Sync Media entry
      let mediaDoc = await MediaModel.findOne({ filename: dbFilename })

      if (!mediaDoc) {
        console.log(`Creating Media entry: ${dbFilename}`)
        mediaDoc = await MediaModel.create({
          filename: dbFilename,
          prefix: `${folder}/`,
          mimeType: justFilename.endsWith('.webp')
            ? 'image/webp'
            : justFilename.endsWith('.png')
              ? 'image/png'
              : 'image/jpeg',
          filesize: object.Size || 0,
          width: 400,
          height: 300,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
      const mediaId = mediaDoc.id || mediaDoc._id

      // 2. Link to Collection
      if (folder === 'products') {
        const stem = justFilename.split('.').slice(0, -1).join('.')
        const normalizedStem = stem.replace(/-400x300$/, '').trim()

        // Find product by name
        const product = await ProductModel.findOne({
          $or: [{ name: normalizedStem }, { name: stem }],
        })

        if (product) {
          const isLinked = product.images?.some(
            (img: any) => img.image?.toString() === mediaId.toString(),
          )

          if (!isLinked) {
            console.log(`Linking to product: ${product.name}`)
            await ProductModel.updateOne(
              { _id: product._id },
              { $push: { images: { image: mediaId } } },
            )
          }
        }
      } else if (folder === 'categories' || folder === 'category') {
        const stem = justFilename.split('.').slice(0, -1).join('.').trim()
        const category = await CategoryModel.findOne({ name: stem })

        if (category) {
          if (!category.image || category.image.toString() !== mediaId.toString()) {
            console.log(`Linking to category: ${category.name}`)
            await CategoryModel.updateOne({ _id: category._id }, { $set: { image: mediaId } })
          }
        }
      } else if (folder === 'expense' || folder === 'returnorder') {
        // For expenses and returns, we just ensure the media document exists.
        // They are usually linked by ID during creation, so we don't try to link by filename here.
        // Just having the media doc with the correct filename/prefix is enough for Payload to find it.
      }
    }
  } catch (err) {
    console.error('Error:', err)
  }

  console.log(`--- Finished ${folder} ---`)
}

run()
