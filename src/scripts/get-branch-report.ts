import { getPayload } from 'payload'
import config from '@payload-config'

const generateReport = async () => {
  const payload = await getPayload({ config })

  // Yesterday's date: 2025-12-26
  const startDate = '2025-12-26'
  const endDate = '2025-12-26'

  // Start of day (00:00:00 UTC) for startDate
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const startOfDay = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0))

  // End of day (23:59:59 UTC) for endDate
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
  const endOfDay = new Date(Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999))

  console.log(`Generating report for: ${startDate}`)

  try {
    const ClosingModel = payload.db.collections['closing-entries']

    // MongoDB Aggregation Pipeline
    const stats = await ClosingModel.aggregate([
      {
        $match: {
          date: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        },
      },
      {
        $group: {
          _id: '$branch', // Group by Branch ID
          totalBills: { $sum: '$totalBills' },
          totalSales: { $sum: '$totalSales' },
          net: { $sum: '$net' },
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
          totalSales: 1,
          net: 1,
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
        totalSales: (acc.totalSales || 0) + (curr.totalSales || 0),
        net: (acc.net || 0) + (curr.net || 0),
      }),
      { totalBills: 0, totalSales: 0, net: 0 },
    )

    console.log('\n--- TOTALS ---')
    console.table([totals])
  } catch (error) {
    console.error('Failed to generate report:', error)
  }

  process.exit(0)
}

generateReport()
