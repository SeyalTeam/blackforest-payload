import { PayloadHandler, PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Kolkata')

export const getReviewReportHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  const startDateParam =
    typeof req.query.startDate === 'string'
      ? req.query.startDate
      : new Date().toISOString().split('T')[0]
  const endDateParam =
    typeof req.query.endDate === 'string'
      ? req.query.endDate
      : new Date().toISOString().split('T')[0]

  // Start of day (00:00:00) for startDate
  const startAndYear = parseInt(startDateParam.split('-')[0])
  const startAndMonth = parseInt(startDateParam.split('-')[1])
  const startAndDay = parseInt(startDateParam.split('-')[2])
  const startOfDay = dayjs
    .tz(`${startAndYear}-${startAndMonth}-${startAndDay}`, 'YYYY-MM-DD', 'Asia/Kolkata')
    .startOf('day')
    .toDate()

  // End of day (23:59:59) for endDate
  const endAndYear = parseInt(endDateParam.split('-')[0])
  const endAndMonth = parseInt(endDateParam.split('-')[1])
  const endAndDay = parseInt(endDateParam.split('-')[2])
  const endOfDay = dayjs
    .tz(`${endAndYear}-${endAndMonth}-${endAndDay}`, 'YYYY-MM-DD', 'Asia/Kolkata')
    .endOf('day')
    .toDate()

  try {
    const reviews = await payload.find({
      collection: 'reviews',
      where: {
        createdAt: {
          greater_than_equal: startOfDay,
          less_than_equal: endOfDay,
        },
      },
      depth: 2, // Need depth 2 to get bill.invoiceNumber and items.product.name (if product is a relation)
      limit: 1000, // Reasonable limit for report
      pagination: false,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flattenedReviews: any[] = []

    reviews.docs.forEach((review) => {
      const items = review.items || []
      const customerName = review.customerName || 'Unknown'
      const customerPhone = review.customerPhone || 'Unknown'
      const billNumber =
        typeof review.bill === 'object' && review.bill && 'invoiceNumber' in review.bill
          ? (review.bill as { invoiceNumber: string }).invoiceNumber
          : 'N/A'

      items.forEach((item) => {
        let productName = 'Unknown Product'
        if (item.product && typeof item.product === 'object' && 'name' in item.product) {
          productName = (item.product as { name: string }).name
        }

        flattenedReviews.push({
          customerName,
          phoneNumber: customerPhone,
          billNumber,
          productName,
          reviewMessage: item.feedback,
          status: item.status,
          reviewDate: review.createdAt,
        })
      })
    })

    const formattedStats = flattenedReviews.map((stat, index) => ({
      sNo: index + 1,
      ...stat,
    }))

    return Response.json({
      startDate: startDateParam,
      endDate: endDateParam,
      stats: formattedStats,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    payload.logger.error({ msg: 'Review Report Error', error, stack: error.stack })
    return Response.json({ error: 'Failed to generate review report' }, { status: 500 })
  }
}
