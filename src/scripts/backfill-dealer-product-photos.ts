import dotenv from 'dotenv'
dotenv.config()
import config from '../payload.config'
import { getPayload } from 'payload'
import mongoose from 'mongoose'

function toHexString(val: any): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (Buffer.isBuffer(val)) return val.toString('hex')
  if (val && typeof val === 'object') {
    if (val._id && val._id !== val) return toHexString(val._id)
    if (typeof val.toString === 'function') {
      const s = val.toString()
      if (typeof s === 'string' && s.length === 24) return s
    }
  }
  return String(val)
}

const run = async () => {
  const payload = await getPayload({ config })
  const DealerBillingModel = payload.db.collections['dealer-billings']
  if (!DealerBillingModel) {
    console.error('No DealerBillingModel found')
    process.exit(1)
  }

  const docs = await DealerBillingModel.find({}).lean()
  console.log(`Found ${docs.length} dealer billings documents`)

  let updatedCount = 0

  for (const doc of docs) {
    let modified = false
    const rawPhotos = Array.isArray(doc.productsPhoto) ? doc.productsPhoto : doc.productsPhoto ? [doc.productsPhoto] : []
    const photosArray = rawPhotos.map(toHexString).filter((s: string) => s.length === 24)

    if (Array.isArray(doc.productsList) && doc.productsList.length > 0 && photosArray.length > 0) {
      const updatedList = doc.productsList.map((item: any, index: number) => {
        const itemPhoto = toHexString(item.photo)
        const itemProdId = toHexString(item.product)
        if (!itemPhoto || itemPhoto.length !== 24) {
          const fallbackPhoto = photosArray[index] || photosArray[0]
          if (fallbackPhoto) {
            modified = true
            return {
              ...item,
              product: itemProdId && itemProdId.length === 24 ? new mongoose.Types.ObjectId(itemProdId) : item.product,
              photo: new mongoose.Types.ObjectId(fallbackPhoto),
            }
          }
        }
        return {
          ...item,
          product: itemProdId && itemProdId.length === 24 ? new mongoose.Types.ObjectId(itemProdId) : item.product,
          photo: itemPhoto && itemPhoto.length === 24 ? new mongoose.Types.ObjectId(itemPhoto) : null,
        }
      })

      if (modified) {
        await DealerBillingModel.updateOne(
          { _id: doc._id },
          { $set: { productsList: updatedList } }
        )
        updatedCount++
        console.log(`Updated dealer billing doc ${doc._id} (${doc.id || doc._id}) with populated productsList photos`)
      }
    }
  }

  console.log(`Backfill completed. Updated ${updatedCount} dealer billing documents.`)
  process.exit(0)
}

run()
