import 'dotenv/config'
import { CopyObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { MongoClient } from 'mongodb'

const FOLDERS = ['products', 'categories', 'expense', 'returnorder'] as const
const TARGET_ROOT = 'blackforest/uploads'
const DRY_RUN = process.argv.includes('--dry-run')

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'auto',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
})

const bucket = process.env.S3_BUCKET || ''
const dbUri = process.env.DATABASE_URI || ''

if (!bucket) throw new Error('S3_BUCKET is required')
if (!dbUri) throw new Error('DATABASE_URI is required')

const exists = async (key: string): Promise<boolean> => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch {
    return false
  }
}

const listKeys = async (prefix: string): Promise<string[]> => {
  const keys: string[] = []
  let token: string | undefined

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    )

    for (const item of res.Contents || []) {
      if (item.Key && !item.Key.endsWith('/')) keys.push(item.Key)
    }

    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)

  return keys
}

const toCopySource = (key: string): string =>
  `${bucket}/${key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`

const migrateR2Keys = async () => {
  const summary = {
    scanned: 0,
    copied: 0,
    skippedAlreadyInTarget: 0,
    skippedTargetExists: 0,
    failed: 0,
  }

  for (const folder of FOLDERS) {
    const sourcePrefix = `${folder}/`
    const keys = await listKeys(sourcePrefix)
    console.log(`[R2] ${folder}: found ${keys.length} source keys under ${sourcePrefix}`)

    for (const sourceKey of keys) {
      summary.scanned += 1
      const targetKey = `${TARGET_ROOT}/${sourceKey}`

      if (sourceKey === targetKey) {
        summary.skippedAlreadyInTarget += 1
        continue
      }

      const targetExists = await exists(targetKey)
      if (targetExists) {
        summary.skippedTargetExists += 1
        continue
      }

      if (DRY_RUN) {
        console.log(`[R2:dry] copy ${sourceKey} -> ${targetKey}`)
        summary.copied += 1
        continue
      }

      try {
        await s3.send(
          new CopyObjectCommand({
            Bucket: bucket,
            Key: targetKey,
            CopySource: toCopySource(sourceKey),
          }),
        )
        summary.copied += 1
      } catch (err) {
        summary.failed += 1
        console.error(`[R2] copy failed ${sourceKey} -> ${targetKey}`, err)
      }
    }
  }

  return summary
}

const normalizeMediaPrefixes = async () => {
  const client = new MongoClient(dbUri)
  await client.connect()
  const db = client.db('blackforest-payload')
  const media = db.collection('media')

  const stats: Array<{ folder: string; matched: number; modified: number }> = []

  for (const folder of FOLDERS) {
    const nextPrefix = `${TARGET_ROOT}/${folder}/`
    const result = await media.updateMany(
      {
        prefix: {
          $in: [folder, `${folder}/`, `${TARGET_ROOT}/${folder}`],
        },
      },
      {
        $set: {
          prefix: nextPrefix,
          updatedAt: new Date(),
        },
      },
    )

    stats.push({
      folder,
      matched: result.matchedCount,
      modified: result.modifiedCount,
    })
  }

  await client.close()
  return stats
}

const run = async () => {
  console.log(`--- R2 Path Migration Started${DRY_RUN ? ' (dry-run)' : ''} ---`)
  const r2 = await migrateR2Keys()
  console.log('[R2] summary:', r2)

  if (!DRY_RUN) {
    const dbStats = await normalizeMediaPrefixes()
    console.log('[DB] media prefix normalization:', dbStats)
  }

  console.log('--- R2 Path Migration Finished ---')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

