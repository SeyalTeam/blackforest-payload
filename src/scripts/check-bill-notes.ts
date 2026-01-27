import 'dotenv/config'
import config from '../payload.config'
import { getPayload } from 'payload'

const checkBill = async () => {
  const payload = await getPayload({ config })
  const billId = '697873f516dd417b0814528b'

  try {
    const bill = await payload.findByID({
      collection: 'billings',
      id: billId,
      depth: 0,
    })

    console.log('Bill ID:', bill.id)
    console.log('Root Notes:', JSON.stringify(bill.notes, null, 2))
    console.log('Items:', JSON.stringify(bill.items, null, 2))
  } catch (error) {
    console.error('Error fetching bill:', error)
  }

  process.exit(0)
}

checkBill()
