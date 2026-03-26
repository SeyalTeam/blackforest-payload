import 'dotenv/config'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

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
        
        console.log(`Found ${closingEntries.docs.length} closing entries:`)
        let prevTime = new Date(dateStr).toISOString() // start of day in some form
        // Using the same logic as the hook
        const startOfDay = new Date(
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
        ).toISOString()
        prevTime = startOfDay

        closingEntries.docs.forEach((entry: any) => {
            console.log(`\n- ${entry.closingNumber}: created at ${entry.createdAt}`)
            console.log(`  stored systemSales: ${entry.systemSales}, totalBills: ${entry.totalBills}`)
            // Now find bills that SHOULD have been in this entry
            // This script assumes they follow the createdAt order
        })

    } catch (err) {
        console.error(err)
    }
    process.exit(0)
}

run()
