import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

const run = async () => {
    const payload = await getPayload({ config: configPromise })
    const branchId = '69724ad6f91273ae0b1e121f'
    
    // Range 4: 2026-05-26T12:44:36.719Z -> 2026-05-26T17:18:08.631Z
    const start = '2026-05-26T12:44:36.719Z'
    const end = '2026-05-26T17:18:08.631Z'

    try {
        const bills = await payload.find({
            collection: 'billings',
            where: {
                and: [
                    { branch: { equals: branchId } },
                    { createdAt: { greater_than: start } },
                    { createdAt: { less_than_equal: end } }
                ]
            },
            limit: 2000,
            depth: 0,
            sort: 'createdAt'
        })

        const completedOrSettled = bills.docs.filter((b: any) => ['completed', 'settled'].includes(b.status))
        
        let cumUpi = 0
        let cumCash = 0
        let cumCard = 0
        let cumTotal = 0

        completedOrSettled.forEach((b: any, index: number) => {
            const method = b.paymentMethod || 'none'
            const amount = b.totalAmount || 0
            if (method === 'upi') cumUpi += amount
            else if (method === 'cash') cumCash += amount
            else if (method === 'card') cumCard += amount
            cumTotal += amount

            if (index >= 75 && index <= 112) {
                console.log(`[${index}] ${b.invoiceNumber}: Method=${method}, Amt=${amount}, CumTotal=${cumTotal}, CumUpi=${cumUpi}, CumCash=${cumCash}, CumCard=${cumCard}, Created=${b.createdAt}`)
            }
        })

    } catch (err) {
        console.error(err)
    }
    process.exit(0)
}

run()
