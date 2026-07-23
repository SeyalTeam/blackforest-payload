import type { PayloadHandler } from 'payload'
import { getOtherProductsInventoryReportData } from '../services/reports/otherProductsInventory'

export const getOtherProductsInventoryReportHandler: PayloadHandler = async (req) => {
  try {
    const url = new URL(req.url || '', 'http://localhost')
    const branch = url.searchParams.get('branch')
    const dealer = url.searchParams.get('dealer')
    const product = url.searchParams.get('product')

    const report = await getOtherProductsInventoryReportData(req, {
      branch,
      dealer,
      product,
    })

    return Response.json(report)
  } catch (error) {
    req.payload.logger.error({ err: error, msg: 'Error generating other products inventory report' })
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 },
    )
  }
}
