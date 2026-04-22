import 'dotenv/config'
import payload from 'payload'

payload.init({ secret: process.env.PAYLOAD_SECRET, mongoURL: process.env.MONGODB_URI, local: true }).then(async () => {
    const bill = await payload.findByID({
      collection: 'billings',
      id: '69e6e86b06c14365bfd7f4f1',
      depth: 0,
    })
    console.log("BILL DETAILS:")
    console.log(JSON.stringify({
      invoiceNumber: bill.invoiceNumber,
      status: bill.status,
      grossAmount: (bill as any).grossAmount,
      totalAmount: bill.totalAmount,
      subTotal: (bill as any).subTotal,
      totalGSTAmount: (bill as any).totalGSTAmount,
      createdAt: bill.createdAt
    }, null, 2))
    process.exit(0)
})
