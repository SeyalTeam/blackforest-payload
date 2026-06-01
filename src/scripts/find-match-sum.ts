import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const run = async () => {
    const payload = await getPayload({ config: configPromise })
    const branchId = '69724ad6f91273ae0b1e121f'
    
    // Range 4: 2026-05-25T12:30:55.722Z -> 2026-05-25T17:18:37.804Z
    const start = '2026-05-25T12:30:55.722Z'
    const end = '2026-05-25T17:18:37.804Z'

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
        
        console.log(`Compact Chronological List of Completed/Settled Bills in Range 4:`)
        let cumulative = 0
        completedOrSettled.forEach((b: any, index: number) => {
            cumulative += b.totalAmount || 0
            // We only print bills around the transition or close to the target of ₹35,359
            // Let's print from index 60 to index 110
            if (index >= 60 && index <= 110) {
                console.log(`[${index}] ${b.invoiceNumber}: Amt=₹${b.totalAmount}, Cum=₹${cumulative}, Created=${b.createdAt}, Updated=${b.updatedAt}`)
            }
        })

    } catch (err) {
        console.error(err)
    }
    process.exit(0)
}

run()
