import { getPayload } from 'payload'
import config from '@payload-config'

const generateBillingReport = async () => {
  const payload = await getPayload({ config })

  // Date: 2025-12-26
  const startDate = '2025-12-26'

  // Start of day (00:00:00 UTC)
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const startOfDay = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0))

  // End of day (23:59:59 UTC)
  const endOfDay = new Date(Date.UTC(startYear, startMonth - 1, startDay, 23, 59, 59, 999))

  console.log(`Generating BILLING report for: ${startDate}`)

  try {
    const BillingModel = payload.db.collections['billings']

    // MongoDB Aggregation Pipeline
    const stats = await BillingModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
          // status: { $ne: 'cancelled' } // Uncomment if we need to exclude cancelled
        },
      },
      {
        $group: {
          _id: '$branch', // Group by Branch ID
          totalBills: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          cash: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$totalAmount', 0],
            },
          },
          card: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'card'] }, '$totalAmount', 0],
            },
          },
          upi: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'upi'] }, '$totalAmount', 0],
            },
          },
          other: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'other'] }, '$totalAmount', 0],
            },
          },
        },
      },
      // Lookup Branch Details
      {
        $lookup: {
          from: 'branches',
          localField: '_id',
          foreignField: '_id',
          as: 'branchDetails',
        },
      },
      {
        $unwind: {
          path: '$branchDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          branchName: { $ifNull: ['$branchDetails.name', 'Unknown Branch'] },
          totalBills: 1,
          totalAmount: 1,
          cash: 1,
          card: 1,
          upi: 1,
          other: 1,
        },
      },
      // Sort by Branch Name
      {
        $sort: { branchName: 1 },
      },
    ])

    console.table(stats)

    // Calculate Totals
    const totals = stats.reduce(
      (acc, curr) => ({
        totalBills: (acc.totalBills || 0) + (curr.totalBills || 0),
        totalAmount: (acc.totalAmount || 0) + (curr.totalAmount || 0),
        cash: (acc.cash || 0) + (curr.cash || 0),
        card: (acc.card || 0) + (curr.card || 0),
        upi: (acc.upi || 0) + (curr.upi || 0),
        other: (acc.other || 0) + (curr.other || 0),
      }),
      { totalBills: 0, totalAmount: 0, cash: 0, card: 0, upi: 0, other: 0 },
    )

    console.log('\n--- TOTALS ---')
    console.table([totals])
  } catch (error) {
    console.error('Failed to generate billing report:', error)
  }

  process.exit(0)
}

generateBillingReport()
