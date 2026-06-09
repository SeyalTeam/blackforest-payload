import { getPayload } from 'payload'
import config from './src/payload.config'

async function run() {
  const payload = await getPayload({ config })
  const branchId = '68fcfbf138714903fbd03e54' // Thoothukudi Macroon
  
  console.log('=== CREATING TEST CLOSING ENTRY ===')
  
  // This will trigger the server-side beforeChange hook
  const testEntry = await payload.create({
    collection: 'closing-entries',
    data: {
      date: '2026-06-09T00:00:00.000Z',
      branch: branchId,
      manualSales: 0,
      onlineSales: 0,
      expenses: 100,
      creditCard: 0,
      upi: 0,
      denominations: {
        count2000: 0,
        count500: 10, // ₹5000 cash
        count200: 0,
        count100: 0,
        count50: 0,
        count10: 0,
        count5: 0
      }
    }
  })

  console.log('\n=== RESULTING DOCUMENT ===')
  console.log(`Closing Number: ${testEntry.closingNumber}`)
  console.log(`Auto-calculated systemSales: ${testEntry.systemSales}`)
  console.log(`Auto-calculated totalBills: ${testEntry.totalBills}`)
  console.log(`Auto-calculated cash: ${testEntry.cash}`)
  console.log(`Auto-calculated totalSales: ${testEntry.totalSales}`)
  console.log(`Auto-calculated totalPayments: ${testEntry.totalPayments}`)
  console.log(`Auto-calculated net: ${testEntry.net}`)
  
  console.log('\n=== CLEANING UP TEST ENTRY ===')
  await payload.delete({
    collection: 'closing-entries',
    id: testEntry.id
  })
  console.log('Mock entry deleted successfully.')
  
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
