import { PayloadHandler } from 'payload'
import { getRawMaterialInventoryReportData } from '../services/reports/rawMaterialInventory'

export const getRawMaterialInventoryReportHandler: PayloadHandler = async (req) => {
  try {
    const url = new URL(req.url || '', 'http://localhost')
    const branch = url.searchParams.get('branch')
    const dealer = url.searchParams.get('dealer')
    const rawMaterial = url.searchParams.get('rawMaterial')
    const purchaseFrequency = url.searchParams.get('purchaseFrequency')

    const report = await getRawMaterialInventoryReportData(req, {
      branch,
      dealer,
      rawMaterial,
      purchaseFrequency,
    })

    return Response.json(report)
  } catch (error: any) {
    req.payload.logger.error(`Error generating Raw Material Inventory report: ${error.message}`)
    return Response.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 },
    )
  }
}
