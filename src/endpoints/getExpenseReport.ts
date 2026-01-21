import { PayloadRequest, PayloadHandler } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export const getExpenseReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  const startDateParam =
    typeof req.query.startDate === 'string' ? req.query.startDate : dayjs().format('YYYY-MM-DD')
  const endDateParam =
    typeof req.query.endDate === 'string' ? req.query.endDate : dayjs().format('YYYY-MM-DD')

  const branchParam = req.query.branch as string
  const categoryParam = req.query.category as string

  // Ensure we are working with the start and end of the day in UTC for database matching
  // FIX: The database stores dates as "Local Time but marked as UTC" (e.g., 23:44 IST is stored as 23:44 Z).
  // Therefore, to find records for "2026-01-21", we must query for 2026-01-21 00:00 Z to 2026-01-21 23:59 Z.
  // We should NOT apply any timezone conversion (like shifting to 18:30 previous day).
  const startOfDay = dayjs.utc(startDateParam).startOf('day').toDate()
  const endOfDay = dayjs.utc(endDateParam).endOf('day').toDate()

  try {
    const ExpenseModel = payload.db.collections['expenses']

    // Categories based on Expenses.ts
    const allCategories = [
      'MAINTENANCE',
      'TRANSPORT',
      'FUEL',
      'PACKING',
      'STAFF WELFARE',
      'Supplies',
      'ADVERTISEMENT',
      'ADVANCE',
      'COMPLEMENTARY',
      'RAW MATERIAL',
      'SALARY',
      'OC PRODUCTS',
      'OTHERS',
    ]

    const selectedBranches =
      typeof branchParam === 'string' && branchParam !== 'all' ? branchParam.split(',') : []

    const selectedCategory =
      typeof categoryParam === 'string' && categoryParam !== 'all' ? categoryParam : 'all'

    // Match stage for Date and Branch
    const matchQuery: any = {
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    }

    if (selectedBranches.length > 0) {
      matchQuery.$expr = {
        $in: [{ $toString: '$branch' }, selectedBranches],
      }
    }

    const pipeline: any[] = [
      {
        $match: matchQuery,
      },
      {
        $unwind: '$details',
      },
    ]

    // Match stage for Category
    if (selectedCategory !== 'all') {
      pipeline.push({
        $match: {
          'details.source': selectedCategory,
        },
      })
    }

    // Lookup Branch info
    pipeline.push(
      {
        $lookup: {
          from: 'branches',
          localField: 'branch',
          foreignField: '_id',
          as: 'branchInfo',
        },
      },
      {
        $unwind: {
          path: '$branchInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'media',
          localField: 'details.image',
          foreignField: '_id',
          as: 'mediaInfo',
        },
      },
      {
        $unwind: {
          path: '$mediaInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: '$branch',
          branchName: { $first: { $ifNull: ['$branchInfo.name', 'Unknown Branch'] } },
          total: { $sum: '$details.amount' },
          count: { $sum: 1 },
          items: {
            $push: {
              category: '$details.source',
              reason: '$details.reason',
              amount: '$details.amount',
              time: '$date',
              imageUrl: '$mediaInfo.url', // Keep for compatibility if virtuals theoretically worked
              filename: '$mediaInfo.filename',
            },
          },
        },
      },
      {
        $sort: { total: -1 }, // Sort branches by highest expense first
      },
    )

    const groups = await ExpenseModel.aggregate(pipeline)

    // Calculate metadata
    const grandTotal = groups.reduce((acc, group) => acc + group.total, 0)
    const totalCount = groups.reduce((acc, group) => acc + group.count, 0)

    // Calculate category-wise statistics
    const categoryStatsMap: Record<string, { total: number; count: number }> = {}
    groups.forEach((group: any) => {
      group.items.forEach((item: any) => {
        if (!categoryStatsMap[item.category]) {
          categoryStatsMap[item.category] = { total: 0, count: 0 }
        }
        categoryStatsMap[item.category].total += item.amount
        categoryStatsMap[item.category].count += 1
      })
    })

    const categoryStats = Object.keys(categoryStatsMap).map((cat) => ({
      category: cat,
      total: categoryStatsMap[cat].total,
      count: categoryStatsMap[cat].count,
      percentage: grandTotal > 0 ? (categoryStatsMap[cat].total / grandTotal) * 100 : 0,
    }))

    // Sort categoryStats by total amount (descending)
    categoryStats.sort((a, b) => b.total - a.total)

    // Sort items within each group by time (descending) and construct image URLs
    groups.forEach((group: any) => {
      group.items.sort((a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime())
      group.items.forEach((item: any) => {
        if (item.filename && !item.imageUrl) {
          item.imageUrl = `/api/media/file/${item.filename}`
        }
      })
    })

    return Response.json({
      startDate: startDateParam,
      endDate: endDateParam,
      groups,
      meta: {
        grandTotal,
        totalCount,
        categories: allCategories,
        categoryStats,
      },
    })
  } catch (error) {
    payload.logger.error(error)
    return Response.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
