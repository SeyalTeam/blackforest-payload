import { type PayloadHandler, type PayloadRequest } from 'payload'
import { getProductPreparationBillDetailsData } from '../services/reports/productPreparation'

export const getProductPreparationBillDetailsHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  try {
    const report = await getProductPreparationBillDetailsData(req, {
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : null,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : null,
      branch: typeof req.query.branch === 'string' ? req.query.branch : null,
      category: typeof req.query.category === 'string' ? req.query.category : null,
      department: typeof req.query.department === 'string' ? req.query.department : null,
      productId: typeof req.query.productId === 'string' ? req.query.productId : null,
      chefId: typeof req.query.chefId === 'string' ? req.query.chefId : null,
      kitchenId: typeof req.query.kitchenId === 'string' ? req.query.kitchenId : null,
      status: typeof req.query.status === 'string' ? req.query.status : null,
    })

    return Response.json(report)
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid productId') {
      return Response.json({ error: 'Invalid productId' }, { status: 400 })
    }

    req.payload.logger.error({ msg: 'Product preparation bill details error', error })
    return Response.json({ error: 'Failed to fetch product preparation bill details' }, { status: 500 })
  }
}
