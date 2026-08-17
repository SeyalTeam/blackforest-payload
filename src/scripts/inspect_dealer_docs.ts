import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import config from '../payload.config'
import { getPayload } from 'payload'

const run = async () => {
  const payload = await getPayload({ config })
  const DealerBillingModel = payload.db.collections['dealer-billings']
  if (!DealerBillingModel) {
    console.error('No DealerBillingModel found')
    process.exit(1)
  }

  const docs = await DealerBillingModel.find({}).sort({ date: -1 }).limit(5).lean()
  console.log('--- Dealer Billings Sample Docs ---')
  for (const d of docs) {
    console.log({
      id: d._id || d.id,
      productsPhoto: d.productsPhoto,
      productsList: d.productsList,
      products: d.products,
    })
  }
  process.exit(0)
}

run()
