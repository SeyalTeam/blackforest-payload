import { PayloadHandler } from 'payload'
import { getStockOrderReportData } from '../services/reports/stockOrder'

export const getStockOrderReportHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  if (!req.url) {
    return Response.json({ message: 'Invalid URL' }, { status: 400 })
  }

  // Parse query params
  const url = new URL(req.url)
  const args = {
    startDate: url.searchParams.get('startDate'),
    endDate: url.searchParams.get('endDate'),
    branch: url.searchParams.get('branch'),
    kitchen: url.searchParams.get('kitchen'),
    department: url.searchParams.get('department'),
    category: url.searchParams.get('category'),
    product: url.searchParams.get('product'),
    chef: url.searchParams.get('chef'),
    status: url.searchParams.get('status'),
    orderType: url.searchParams.get('orderType'),
    invoice: url.searchParams.get('invoice'),
  }

  try {
    const data = await getStockOrderReportData(req, args)
    return Response.json(data)
  } catch (error) {
    req.payload.logger.error(error)
    return Response.json({ message: 'Error generating report' }, { status: 500 })
  }
}
