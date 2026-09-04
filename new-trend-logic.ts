  // Calculate Sales Trend based on Selected Period
  const trendPeriod = args.trendPeriod ?? '12months'
  const now = dayjs().tz('Asia/Kolkata')
  
  let granularity: 'month' | 'day' | 'hour' = 'month'
  let trendStartDate = now.subtract(11, 'month').startOf('month')
  let pointsCount = 12

  if (trendPeriod === 'hourly') {
    granularity = 'hour'
    trendStartDate = dayjs(startOfDay).tz('Asia/Kolkata')
    pointsCount = dayjs(endOfDay).tz('Asia/Kolkata').diff(trendStartDate, 'hour') + 1
  } else if (trendPeriod === 'daily') {
    granularity = 'day'
    trendStartDate = dayjs(startOfDay).tz('Asia/Kolkata')
    pointsCount = dayjs(endOfDay).tz('Asia/Kolkata').diff(trendStartDate, 'day') + 1
  } else if (trendPeriod === 'thisMonth') {
    trendStartDate = now.startOf('month')
    pointsCount = now.date()
    granularity = 'day'
  } else if (trendPeriod === '6months') {
    trendStartDate = now.subtract(5, 'month').startOf('month')
    pointsCount = 6
    granularity = 'month'
  } else if (trendPeriod === '30days') {
    trendStartDate = now.subtract(29, 'day').startOf('day')
    pointsCount = 30
    granularity = 'day'
  } else if (trendPeriod === '7days') {
    trendStartDate = now.subtract(6, 'day').startOf('day')
    pointsCount = 7
    granularity = 'day'
  }

  const trendMatch: any = {
    createdAt: { $gte: trendStartDate.toDate() },
    status: { $in: ['completed', 'settled'] },
    ...branchFilter,
  }
  if (trendPeriod === 'hourly' || trendPeriod === 'daily') {
    trendMatch.createdAt = { $gte: trendStartDate.toDate(), $lte: dayjs(endOfDay).tz('Asia/Kolkata').toDate() }
  }

  const rawTrendStats = await BillingModel.aggregate([
    { $match: trendMatch },
    {
      $group: {
        _id: {
          year: { $year: { $add: ['$createdAt', 19800000] } },
          month: { $month: { $add: ['$createdAt', 19800000] } },
          day: (granularity === 'day' || granularity === 'hour') ? { $dayOfMonth: { $add: ['$createdAt', 19800000] } } : null,
          hour: granularity === 'hour' ? { $hour: { $add: ['$createdAt', 19800000] } } : null,
        },
        totalAmount: { $sum: '$totalAmount' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
  ])

  // Aggregate Expenses for the same trend period
  const expenseTrendMatch: any = {
    date: { $gte: trendStartDate.toDate() },
    ...branchFilter,
  }
  if (trendPeriod === 'hourly' || trendPeriod === 'daily') {
    expenseTrendMatch.date = { $gte: trendStartDate.toDate(), $lte: dayjs(endOfDay).tz('Asia/Kolkata').toDate() }
  }

  const rawExpenseTrendStats = await ExpenseModel.aggregate([
    { $match: expenseTrendMatch },
    { $unwind: '$details' },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: (granularity === 'day' || granularity === 'hour') ? { $dayOfMonth: '$date' } : null,
          hour: granularity === 'hour' ? { $hour: '$date' } : null,
        },
        totalExpense: { $sum: '$details.amount' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
  ])

  // Aggregate Returns for the same trend period
  const returnTrendMatch: any = {
    createdAt: { $gte: trendStartDate.toDate() },
    ...branchFilter,
  }
  if (trendPeriod === 'hourly' || trendPeriod === 'daily') {
    returnTrendMatch.createdAt = { $gte: trendStartDate.toDate(), $lte: dayjs(endOfDay).tz('Asia/Kolkata').toDate() }
  }

  const rawReturnTrendStats = await ReturnOrderModel.aggregate([
    { $match: returnTrendMatch },
    {
      $group: {
        _id: {
          year: { $year: { $add: ['$createdAt', 19800000] } },
          month: { $month: { $add: ['$createdAt', 19800000] } },
          day: (granularity === 'day' || granularity === 'hour') ? { $dayOfMonth: { $add: ['$createdAt', 19800000] } } : null,
          hour: granularity === 'hour' ? { $hour: { $add: ['$createdAt', 19800000] } } : null,
        },
        totalReturn: { $sum: '$totalAmount' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
  ])

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const trendData: TrendPoint[] = []

  for (let i = 0; i < pointsCount; i += 1) {
    let d = trendStartDate
    if (granularity === 'month') d = trendStartDate.add(i, 'month')
    else if (granularity === 'day') d = trendStartDate.add(i, 'day')
    else if (granularity === 'hour') d = trendStartDate.add(i, 'hour')

    const year = d.year()
    const month = d.month() + 1
    const day = (granularity === 'day' || granularity === 'hour') ? d.date() : null
    const hour = granularity === 'hour' ? d.hour() : null

    const found = rawTrendStats.find(
      (s) =>
        s._id.year === year &&
        s._id.month === month &&
        (granularity === 'month' || s._id.day === day) &&
        (granularity !== 'hour' || s._id.hour === hour),
    )

    const foundExpense = rawExpenseTrendStats.find(
      (s) =>
        s._id.year === year &&
        s._id.month === month &&
        (granularity === 'month' || s._id.day === day) &&
        (granularity !== 'hour' || s._id.hour === hour),
    )

    const foundReturn = rawReturnTrendStats.find(
      (s) =>
        s._id.year === year &&
        s._id.month === month &&
        (granularity === 'month' || s._id.day === day) &&
        (granularity !== 'hour' || s._id.hour === hour),
    )

    const dayInitials = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    let label = ''
    let fullLabel = ''

    if (granularity === 'month') {
      label = monthNames[month - 1]
      fullLabel = `${monthNames[month - 1]} ${year}`
    } else if (granularity === 'day') {
      label = `${d.date()}|${dayInitials[d.day()]}`
      fullLabel = `${monthNames[month - 1]} ${d.date()}`
    } else if (granularity === 'hour') {
      label = d.format('h A')
      fullLabel = `${monthNames[month - 1]} ${d.date()}, ${d.format('h A')}`
    }

    trendData.push({
      label,
      fullLabel,
      totalAmount: found?.totalAmount ?? 0,
      totalExpense: foundExpense?.totalExpense ?? 0,
      totalReturn: foundReturn?.totalReturn ?? 0,
    })
  }

