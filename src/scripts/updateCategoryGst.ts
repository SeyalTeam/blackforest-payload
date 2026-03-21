import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../payload.config'

const categoryName = process.argv[2]?.trim()
const allowedGSTValues = ['0', '5', '12', '18', '22'] as const
type AllowedGSTValue = (typeof allowedGSTValues)[number]

const normalizeGSTValue = (value?: string): AllowedGSTValue | null => {
  const normalizedValue = value?.trim() || ''
  return allowedGSTValues.includes(normalizedValue as AllowedGSTValue)
    ? (normalizedValue as AllowedGSTValue)
    : null
}

const gstValue = normalizeGSTValue(process.argv[3])

if (!categoryName || !gstValue) {
  console.error(
    `Usage: node --import tsx src/scripts/updateCategoryGst.ts "<CATEGORY NAME>" <${allowedGSTValues.join('|')}>`,
  )
  process.exit(1)
}

const run = async () => {
  const payload = await getPayload({ config })

  const categoryResult = await payload.find({
    collection: 'categories',
    limit: 1,
    depth: 0,
    where: {
      name: {
        equals: categoryName,
      },
    },
  })

  const category = categoryResult.docs[0]
  if (!category) {
    throw new Error(`Category not found: ${categoryName}`)
  }

  const products = await payload.find({
    collection: 'products',
    limit: 1000,
    depth: 0,
    sort: 'name',
    where: {
      category: {
        equals: category.id,
      },
    },
  })

  const ProductModel = (payload.db as any).collections?.products
  if (!ProductModel) {
    throw new Error('Products DB model not found')
  }

  let payloadUpdated = 0
  let mongoFallbackUpdated = 0

  for (const product of products.docs) {
    const branchOverrides = Array.isArray(product.branchOverrides)
      ? product.branchOverrides.map((override) => ({
          ...override,
          gst: gstValue,
        }))
      : product.branchOverrides

    try {
      await payload.update({
        collection: 'products',
        id: product.id,
        data: {
          defaultPriceDetails: {
            ...(product.defaultPriceDetails || {}),
            gst: gstValue,
          },
          ...(branchOverrides !== undefined ? { branchOverrides } : {}),
        },
      })

      payloadUpdated += 1
      console.log(`Payload update ok: ${product.name}`)
    } catch (error) {
      const updateOps: Record<string, unknown> = {
        'defaultPriceDetails.gst': gstValue,
      }

      if (Array.isArray(product.branchOverrides) && product.branchOverrides.length > 0) {
        product.branchOverrides.forEach((_override, index) => {
          updateOps[`branchOverrides.${index}.gst`] = gstValue
        })
      }

      await ProductModel.updateOne(
        { _id: product.id },
        {
          $set: updateOps,
        },
      )

      mongoFallbackUpdated += 1
      console.log(
        `Mongo fallback ok: ${product.name} (${error instanceof Error ? error.message : 'unknown error'})`,
      )
    }
  }

  const verified = await payload.find({
    collection: 'products',
    limit: 1000,
    depth: 0,
    sort: 'name',
    where: {
      category: {
        equals: category.id,
      },
    },
  })

  console.log(`Verification for ${categoryName}`)
  for (const product of verified.docs) {
    const overrideGst = (Array.isArray(product.branchOverrides) ? product.branchOverrides : [])
      .map((override) => override.gst ?? '')
      .join(',')

    console.log(
      `${product.name} | gst=${product.defaultPriceDetails?.gst ?? ''} | overrideGST=${overrideGst}`,
    )
  }

  console.log(
    `Summary: products=${products.docs.length} payloadUpdated=${payloadUpdated} mongoFallbackUpdated=${mongoFallbackUpdated}`,
  )
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
