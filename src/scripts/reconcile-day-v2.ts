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
    const dateStr = '2026-03-24'
    const startOfDay = dayjs.tz(dateStr, 'Asia/Kolkata').startOf('day').toISOString()
    const endOfDay = dayjs.tz(dateStr, 'Asia/Kolkata').endOf('day').toISOString()

    try {
        const closingEntries = await payload.find({
            collection: 'closing-entries',
            where: {
                and: [
                    { branch: { equals: branchId } },
                    { date: { equals: new Date(Date.UTC(2026, 2, 24, 0, 0, 0, 0)).toISOString() } }
                ]
            },
            sort: 'createdAt'
        })
        
        console.log(`\nReconciling ${closingEntries.docs.length} Closing Entries.`)

        let lastTime = startOfDay
        for (const entry of closingEntries.docs) {
            const entryTime = new Date(entry.createdAt).toISOString()
            const storedSystemSales = entry.systemSales ?? 0
            const storedBillCount = entry.totalBills ?? 0
            const bills = await payload.find({
                collection: 'billings',
                where: {
                    and: [
                        { branch: { equals: branchId } },
                        { createdAt: { greater_than: lastTime } },
                        { createdAt: { less_than_equal: entryTime } },
                    ]
                },
                limit: 1000,
                depth: 0,
            })
            const completedBills = bills.docs.filter((b: any) => b.status === 'completed')
            const sumCompleted = completedBills.reduce((s, b: any) => s + (b.totalAmount || 0), 0)
            
            console.log(`\n- Entry ${entry.closingNumber}: stored sales ${storedSystemSales}, count ${storedBillCount}`)
            console.log(`  Actual: sum of completed ₹${sumCompleted.toFixed(2)}, total count ${bills.docs.length}`)
            
            if (Math.abs(sumCompleted - storedSystemSales) > 0.1) {
                console.log(`  [!] Amount Discrepancy: ₹${(sumCompleted - storedSystemSales).toFixed(2)}`)
            }
            if (bills.docs.length !== storedBillCount) {
                console.log(`  [!] Count Discrepancy: ${bills.docs.length - storedBillCount} bills`)
            }

            lastTime = entryTime
        }

        // Final check
        const afterBills = await payload.find({
            collection: 'billings',
            where: {
                and: [
                    { branch: { equals: branchId } },
                    { createdAt: { greater_than: lastTime } },
                    { createdAt: { less_than_equal: endOfDay } },
                    { status: { equals: 'completed' } }
                ]
            },
            limit: 1000,
        })

        if (afterBills.docs.length > 0) {
            const sumAfter = afterBills.docs.reduce((s, b: any) => s + (b.totalAmount || 0), 0)
            console.log(`\nBills created AFTER the last closing (unaccounted in entries):`)
            console.log(`Count: ${afterBills.docs.length}, Sum: ₹${sumAfter.toFixed(2)}`)
        }

    } catch (err) {
        console.error(err)
    }
    process.exit(0)
}

run()
