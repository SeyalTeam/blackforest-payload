import { PayloadRequest, PayloadHandler } from 'payload'
import PDFDocument from 'pdfkit'
import path from 'path'
import fs from 'fs'

export const getCategoryWiseReportPDFHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  // 1. Get dates from query param
  const startDateParam =
    typeof req.query.startDate === 'string'
      ? req.query.startDate
      : new Date().toISOString().split('T')[0]
  const endDateParam =
    typeof req.query.endDate === 'string'
      ? req.query.endDate
      : new Date().toISOString().split('T')[0]

  const startOfDay = new Date(startDateParam)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(endDateParam)
  endOfDay.setHours(23, 59, 59, 999)

  const branchParam = typeof req.query.branch === 'string' ? req.query.branch : ''

  try {
    payload.logger.info(
      `Generating Category Wise Report PDF for ${startDateParam} to ${endDateParam}`,
    )

    // --- FONT SETUP ---
    const fontsDir = path.join(process.cwd(), 'src/assets/fonts')
    const fontRegular = path.join(fontsDir, 'Inter-Regular.ttf')
    const fontBold = path.join(fontsDir, 'Inter-Bold.ttf')

    const hasRegular = fs.existsSync(fontRegular)
    const hasBold = fs.existsSync(fontBold)

    if (!hasRegular) payload.logger.warn(`Regular font not found at ${fontRegular}`)
    if (!hasBold) payload.logger.warn(`Bold font not found at ${fontBold}`)

    // --- DATA FETCHING ---
    const branches = await payload.find({
      collection: 'branches',
      limit: 100,
      pagination: false,
    })

    const branchMap: Record<string, string> = {}
    branches.docs.forEach((b) => {
      branchMap[b.id] = b.name.substring(0, 3).toUpperCase()
    })

    const BillingModel = payload.db.collections['billings']
    const matchQuery: any = {
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    }

    if (branchParam && branchParam !== 'all') {
      matchQuery.$expr = {
        $eq: [{ $toString: '$branch' }, branchParam],
      }
    }

    const rawStats = await BillingModel.aggregate([
      { $match: matchQuery },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: '$productDetails' },
      {
        $lookup: {
          from: 'categories',
          localField: 'productDetails.category',
          foreignField: '_id',
          as: 'categoryDetails',
        },
      },
      { $unwind: '$categoryDetails' },
      {
        $group: {
          _id: {
            categoryName: '$categoryDetails.name',
            branchId: '$branch',
          },
          quantity: { $sum: '$items.quantity' },
          amount: { $sum: '$items.subtotal' },
        },
      },
      {
        $group: {
          _id: '$_id.categoryName',
          totalQuantity: { $sum: '$quantity' },
          totalAmount: { $sum: '$amount' },
          branchData: {
            $push: {
              branchId: '$_id.branchId',
              amount: '$amount',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          categoryName: '$_id',
          totalQuantity: 1,
          totalAmount: 1,
          branchData: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ])

    const branchTotals: Record<string, number> = {}
    rawStats.forEach((stat: any) => {
      stat.branchData.forEach((b: any) => {
        const bId = b.branchId.toString()
        if (branchMap[bId]) {
          const code = branchMap[bId]
          branchTotals[code] = (branchTotals[code] || 0) + b.amount
        }
      })
    })

    const branchHeaders = Object.keys(branchTotals)
      .filter((code) => branchTotals[code] > 0)
      .sort((a, b) => branchTotals[b] - branchTotals[a])

    const formattedStats = rawStats.map((item: any, index: number) => {
      const branchSales: Record<string, number> = {}
      item.branchData.forEach((b: any) => {
        const bId = b.branchId.toString()
        if (branchMap[bId]) {
          const code = branchMap[bId]
          branchSales[code] = b.amount
        }
      })
      return {
        sNo: index + 1,
        categoryName: item.categoryName,
        totalQuantity: item.totalQuantity,
        totalAmount: item.totalAmount,
        branchSales,
      }
    })

    const totals = formattedStats.reduce(
      (acc: any, curr: any) => ({
        totalQuantity: acc.totalQuantity + curr.totalQuantity,
        totalAmount: acc.totalAmount + curr.totalAmount,
      }),
      { totalQuantity: 0, totalAmount: 0 },
    )

    // --- PDF GENERATION ---
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' })
    const chunks: any[] = []

    doc.on('data', (chunk) => chunks.push(chunk))

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Register and Apply default font
      if (hasRegular) {
        doc.font(fontRegular)
      }

      // Helper to set font based on bold requirement
      const setDocFont = (bold = false) => {
        if (bold && hasBold) doc.font(fontBold)
        else if (hasRegular) doc.font(fontRegular)
      }

      // Title & Dates
      setDocFont(true) // Bold for title
      doc.fontSize(18).text('Category Wise Report', { align: 'center' })
      doc.moveDown(0.5)

      setDocFont(false) // Regular for dates
      doc.fontSize(10).text(`Date: ${startDateParam} to ${endDateParam}`, { align: 'center' })
      doc.moveDown(1)

      // Table Setup
      const startX = 30
      let y = 100
      const rowHeight = 20
      const pageWidth = doc.page.width - 60

      const sNoWidth = 40
      const categoryWidth = 120
      const totalQtyWidth = 70
      const totalAmtWidth = 80
      const remainingWidth = pageWidth - (sNoWidth + categoryWidth + totalQtyWidth + totalAmtWidth)
      const branchColWidth = branchHeaders.length > 0 ? remainingWidth / branchHeaders.length : 0

      const drawRow = (data: string[], isHeader = false) => {
        if (y > doc.page.height - 50) {
          doc.addPage({ layout: 'landscape', margin: 30 })
          y = 30
        }

        let curX = startX
        if (isHeader) {
          doc.rect(startX, y, pageWidth, rowHeight).fill('#f0f0f0').stroke()
          setDocFont(true)
        } else {
          setDocFont(false)
        }
        doc.fillColor('black')

        data.forEach((text, i) => {
          let w = 0
          let align: 'left' | 'center' | 'right' = 'left'
          if (i === 0) {
            w = sNoWidth
            align = 'center'
          } else if (i === 1) {
            w = categoryWidth
            align = 'left'
          } else if (i < data.length - 2) {
            w = branchColWidth
            align = 'right'
          } else if (i === data.length - 2) {
            w = totalQtyWidth
            align = 'right'
          } else {
            w = totalAmtWidth
            align = 'right'
          }

          doc.fontSize(9).text(text, curX + 2, y + 5, {
            width: w - 4,
            align,
            height: rowHeight - 10,
            ellipsis: true,
          })
          doc.rect(curX, y, w, rowHeight).stroke()
          curX += w
        })
        y += rowHeight
      }

      // Headers
      drawRow(['S.No', 'Category', ...branchHeaders, 'Total Qty', 'Total Amt'], true)

      // Data Rows
      formattedStats.forEach((r: any) => {
        const rowData = [
          r.sNo.toString(),
          r.categoryName,
          ...branchHeaders.map((h) => (r.branchSales[h] || 0).toFixed(2)),
          r.totalQuantity.toString(),
          r.totalAmount.toFixed(2),
        ]
        drawRow(rowData)
      })

      // Grand Total
      drawRow(
        [
          '',
          'TOTAL',
          ...branchHeaders.map(() => ''),
          totals.totalQuantity.toString(),
          totals.totalAmount.toFixed(2),
        ],
        true,
      )

      doc.end()
    })

    return new Response(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="category_report_${startDateParam}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    payload.logger.error({ msg: 'PDF Generation Error', error, stack: error.stack })
    return new Response(JSON.stringify({ error: error.message || 'Failed to generate PDF' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
