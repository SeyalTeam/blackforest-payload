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

  const branchParam = req.query.branch
  const categoryParam = req.query.category

  const startOfDay = dayjs.tz(startDateParam, 'YYYY-MM-DD', 'Asia/Kolkata').startOf('day').toDate()
  const endOfDay = dayjs.tz(endDateParam, 'YYYY-MM-DD', 'Asia/Kolkata').endOf('day').toDate()

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

    const selectedCategories =
      typeof categoryParam === 'string' && categoryParam !== 'all'
        ? categoryParam.split(',')
        : allCategories

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

    // Filter by selected categories if not "all"
    if (typeof categoryParam === 'string' && categoryParam !== 'all') {
      pipeline.push({
        $match: {
          'details.source': { $in: selectedCategories },
        },
      })
    }

    pipeline.push(
      {
        $group: {
          _id: {
            branch: '$branch',
            source: '$details.source',
          },
          amount: { $sum: '$details.amount' },
        },
      },
      {
        $group: {
          _id: '$_id.branch',
          categories: {
            $push: {
              source: '$_id.source',
              amount: '$amount',
            },
          },
          total: { $sum: '$amount' },
        },
      },
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
          branchId: '$_id',
          branchName: { $ifNull: ['$branchDetails.name', 'Unknown Branch'] },
          categories: 1,
          total: 1,
        },
      },
      {
        $sort: { branchName: 1 },
      },
    )

    const isDetailRequest = req.query.details === 'true'
    const targetBranch = req.query.branchId as string
    const targetCategory = req.query.category as string

    if (isDetailRequest && targetBranch && targetCategory) {
      const detailPipeline: any[] = [
        {
          $match: {
            date: { $gte: startOfDay, $lte: endOfDay },
            ...(targetBranch !== 'all'
              ? {
                  $expr: {
                    $eq: [{ $toString: '$branch' }, targetBranch],
                  },
                }
              : {}),
          },
        },
        { $unwind: '$details' },
        ...(targetCategory !== 'all'
          ? [
              {
                $match: {
                  'details.source': targetCategory,
                },
              },
            ]
          : []),
        {
          $lookup: {
            from: 'branches',
            localField: 'branch',
            foreignField: '_id',
            as: 'branchInfo',
          },
        },
        { $unwind: '$branchInfo' },
        {
          $project: {
            _id: 0,
            date: 1,
            time: '$date',
            branchName: '$branchInfo.name',
            category: '$details.source',
            reason: '$details.reason',
            amount: '$details.amount',
          },
        },
        { $sort: { date: -1 } },
      ]

      const detailResults = await ExpenseModel.aggregate(detailPipeline)
      return Response.json({ details: detailResults })
    }

    const results = await ExpenseModel.aggregate(pipeline)

    // Format data using only selected categories for columns
    const stats = results.map((item: any) => {
      const categoryTotals: any = {}
      selectedCategories.forEach((cat) => {
        const found = item.categories.find((c: any) => c.source === cat)
        categoryTotals[cat] = found ? found.amount : 0
      })
      return {
        branchId: item.branchId,
        branchName: item.branchName,
        ...categoryTotals,
        total: item.total,
      }
    })

    // Calculate grand totals for selected categories
    const totals: any = {
      total: 0,
    }
    selectedCategories.forEach((cat) => {
      totals[cat] = stats.reduce((acc: number, curr: any) => acc + (curr[cat] || 0), 0)
      totals.total += totals[cat]
    })

    return Response.json({
      startDate: startDateParam,
      endDate: endDateParam,
      stats: stats.map((s, i) => ({ ...s, sNo: i + 1 })),
      totals,
      categories: selectedCategories,
    })
  } catch (error) {
    payload.logger.error(error)
    return Response.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
