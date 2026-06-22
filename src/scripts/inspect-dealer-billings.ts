import dotenv from 'dotenv'
dotenv.config()
import config from '../payload.config'
import { getPayload } from 'payload'
import mongoose from 'mongoose'

const run = async () => {
  const payload = await getPayload({ config })
  const DealerBillingModel = payload.db.collections['dealer-billings']
  if (!DealerBillingModel) {
    console.error('No DealerBillingModel found')
    process.exit(1)
  }

  const docs = await DealerBillingModel.find({}).sort({ date: -1 }).limit(10).lean()
  console.log('--- Dealer Billings ---')
  console.log(JSON.stringify(docs.map((d: any) => ({
    id: d._id || d.id,
    dealer: d.dealer,
    total: d.total,
    paidAmount: d.paidAmount,
    status: d.status,
    date: d.date,
  })), null, 2))
  process.exit(0)
}

run()
