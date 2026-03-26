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
    const d = new Date(dateStr)
    const normalizedDateString = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
    ).toISOString()

    try {
        const closingEntries = await payload.find({
            collection: 'closing-entries',
            where: {
                and: [
                    { branch: { equals: branchId } },
                    { date: { equals: normalizedDateString } }
                ]
            },
            sort: 'createdAt'
        })
        
        const startOfDay = dayjs.tz(dateStr, 'Asia/Kolkata').startOf('day').toISOString()
        const endOfDay = dayjs.tz(dateStr, 'Asia/Kolkata').endOf('day').toISOString()

        const allBills = await payload.find({
            collection: 'billings',
            where: {
                and: [
                    { branch: { equals: branchId } },
                    { createdAt: { greater_than_equal: startOfDay } },
                    { createdAt: { less_than_equal: endOfDay } }
                ]
            },
            limit: 1000,
            depth: 0,
            sort: 'createdAt'
        })

        console.log(`\nFound ${closingEntries.docs.length} Closing Entries and ${allBills.docs.length} Bills for ${dateStr}.`)

        let lastTime = startOfDay
        let totalSystemSalesInClosings = 0
        let totalBillsInClosings = 0

        closingEntries.docs.forEach((entry: any) => {
            const entryTime = new Date(entry.createdAt).toISOString()
            console.log(`\nEntry: ${entry.closingNumber} (Created: ${entryTime})`)
            console.log(`Stored System Sales: ${entry.systemSales}, Stored Bill Count: ${entry.totalBills}`)
            
            totalSystemSalesInClosings += (entry.systemSales || 0)
            totalBillsInClosings += (entry.totalBills || 0)

            // Find bills in this duration
            const billsInRange = allBills.docs.filter((bill: any) => {
                return bill.createdAt > lastTime && bill.createdAt <= entryTime
            })

            const sumInRange = billsInRange.filter((b: any) => b.status === 'completed').reduce((s, b: any) => s + (b.totalAmount || 0), 0)
            console.log(`Actual Bills in this range: ${billsInRange.length} (Sum of completed: ${sumInRange.toFixed(2)})`)
            if (Math.abs(sumInRange - (entry.systemSales || 0)) > 0.01) {
                console.log(`   [!] DISCREPANCY: Stored systemSales (${entry.systemSales}) != Actual completed bills sum (${sumInRange.toFixed(2)})`)
            }
            if (billsInRange.length !== (entry.totalBills || 0)) {
                console.log(`   [!] DISCREPANCY: Stored totalBills count (${entry.totalBills}) != Actual bills count (${billsInRange.length})`)
            }

            lastTime = entryTime
        })

        // Bills after the last closing
        const billsAfterLast = allBills.docs.filter((bill: any) => {
            return bill.createdAt > lastTime && bill.createdAt <= endOfDay
        })

        if (billsAfterLast.length > 0) {
            const sumAfter = billsAfterLast.filter((b: any) => b.status === 'completed').reduce((s, b: any) => s + (b.totalAmount || 0), 0)
            console.log(`\nBills created AFTER the last closing entry:`)
            console.log(`Count: ${billsAfterLast.length}, Sum of completed: ${sumAfter.toFixed(2)}`)
            billsAfterLast.forEach((b: any) => {
                console.log(`- ${b.invoiceNumber}: ${b.status}, Created: ${b.createdAt}, Amount: ${b.totalAmount}`)
            })
        }

        console.log(`\nSummary:`)
        console.log(`Total Stored System Sales: ${totalSystemSalesInClosings.toFixed(2)}`)
        console.log(`Total Stored Bill Count: ${totalBillsInClosings}`)
        
        const dayTotalSum = allBills.docs.filter((b: any) => b.status === 'completed').reduce((s, b: any) => s + (b.totalAmount || 0), 0)
        console.log(`\nTotal for whole day across all bills (completed status):`)
        console.log(`Count: ${allBills.docs.filter(b => b.status === 'completed').length}, Amount: ${dayTotalSum.toFixed(2)}`)

    } catch (err) {
        console.error(err)
    }
    process.exit(0)
}

run()
