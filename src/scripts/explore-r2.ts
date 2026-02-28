import 'dotenv/config'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const run = async () => {
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

  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Delimiter: '/',
      Prefix: 'blackforest/uploads/',
    })

    const data = await s3Client.send(command)
    console.log('Folders found under blackforest/uploads/:')
    data.CommonPrefixes?.forEach((p) => console.log(` - ${p.Prefix}`))

    console.log('\nFiles found directly in blackforest/uploads/:')
    data.Contents?.forEach((c) => console.log(` - ${c.Key}`))
  } catch (err) {
    console.error('Error:', err)
  }
  process.exit(0)
}

run()
