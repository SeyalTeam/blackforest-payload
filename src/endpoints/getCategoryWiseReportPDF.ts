import { PayloadRequest, PayloadHandler } from 'payload'
import PDFDocument from 'pdfkit'

export const getCategoryWiseReportPDFHandler: PayloadHandler = async (
  req: PayloadRequest,
): Promise<Response> => {
  const { payload } = req

  // 1. Get date from query param or use today
  const startDateParam =
    typeof req.query.startDate === 'string'
      ? req.query.startDate
      : new Date().toISOString().split('T')[0]
  const endDateParam =
    typeof req.query.endDate === 'string'
      ? req.query.endDate
      : new Date().toISOString().split('T')[0]

  // Start of day (00:00:00)
  const startOfDay = new Date(startDateParam)
  startOfDay.setHours(0, 0, 0, 0)

  // End of day (23:59:59)
  const endOfDay = new Date(endDateParam)
  endOfDay.setHours(23, 59, 59, 999)

  const branchParam = typeof req.query.branch === 'string' ? req.query.branch : ''

  try {
    // --- DATA FETCHING (Same as getCategoryWiseReport.ts) ---

    // 1. Fetch all branches map (ID -> Code)
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

    // Construct match query
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

    // 2. Aggregate Data
    const rawStats = await BillingModel.aggregate([
      {
        $match: matchQuery,
      },
      {
        $unwind: '$items',
      },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      {
        $unwind: '$productDetails',
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'productDetails.category',
          foreignField: '_id',
          as: 'categoryDetails',
        },
      },
      {
        $unwind: '$categoryDetails',
      },
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
      {
        $sort: { totalAmount: -1 },
      },
    ])

    // 3. Calculate Branch Totals to Sort Headers
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

    // 4. Create Sorted Header List
    // Filter out branches with <= 0 sales and Sort by Amount Desc
    const branchHeaders = Object.keys(branchTotals)
      .filter((code) => branchTotals[code] > 0)
      .sort((a, b) => branchTotals[b] - branchTotals[a])

    // 5. Format Stats
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

    // Calculate Grand Totals
    const totals = formattedStats.reduce(
      (acc: any, curr: any) => ({
        totalQuantity: acc.totalQuantity + curr.totalQuantity,
        totalAmount: acc.totalAmount + curr.totalAmount,
      }),
      { totalQuantity: 0, totalAmount: 0 },
    )

    // --- PDF GENERATION (BUFFERED) ---
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk) => chunks.push(chunk))

    // Wrap doc.end() in a promise to await completion
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // --- PDF CONTENT ---

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text('Category Wise Report', { align: 'center' })
      doc.moveDown(0.5)

      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Date: ${startDateParam} to ${endDateParam}`, { align: 'center' })

      doc.moveDown(1)

      // Table Config
      const tableTop = 100
      const startX = 30
      const rowHeight = 20
      const pageWidth = doc.page.width - 60

      // Column Widths
      const sNoWidth = 40
      const categoryWidth = 120
      const totalQtyWidth = 70
      const totalAmtWidth = 80

      const fixedWidth = sNoWidth + categoryWidth + totalQtyWidth + totalAmtWidth
      const remainingWidth = pageWidth - fixedWidth
      const branchColWidth = branchHeaders.length > 0 ? remainingWidth / branchHeaders.length : 0

      // Helper to draw cell
      const drawCell = (
        text: string,
        x: number,
        y: number,
        w: number,
        align: 'left' | 'center' | 'right' = 'left',
        bold = false,
      ) => {
        if (bold) doc.font('Helvetica-Bold')
        else doc.font('Helvetica')

        // Truncate text if too long? For now let it clip or wrap naturally (PDFKit wraps by default if width set)
        // But we set height 20 so wrapping might look bad.
        // Let's force single line by replacing newlines
        const safeText = text.replace(/\n/g, ' ')

        doc.text(safeText, x + 2, y + 5, {
          width: w - 4,
          align: align,
          height: rowHeight - 10,
          ellipsis: true,
        })
        // box
        doc.rect(x, y, w, rowHeight).stroke()
      }

      let currentX = startX
      let y = tableTop

      // Header Row
      doc.rect(startX, y, pageWidth, rowHeight).fill('#f0f0f0').stroke()
      doc.fillColor('black')

      drawCell('S.No', currentX, y, sNoWidth, 'center', true)
      currentX += sNoWidth

      drawCell('Category', currentX, y, categoryWidth, 'left', true)
      currentX += categoryWidth

      branchHeaders.forEach((header) => {
        drawCell(header, currentX, y, branchColWidth, 'center', true)
        currentX += branchColWidth
      })

      drawCell('Total Qty', currentX, y, totalQtyWidth, 'right', true)
      currentX += totalQtyWidth

      drawCell('Total Amt', currentX, y, totalAmtWidth, 'right', true)

      y += rowHeight

      // Data Rows
      formattedStats.forEach((row: any) => {
        // Check page break
        if (y > doc.page.height - 50) {
          doc.addPage({ layout: 'landscape', margin: 30 })
          y = 30 // Reset y
        }

        currentX = startX

        drawCell(row.sNo.toString(), currentX, y, sNoWidth, 'center')
        currentX += sNoWidth

        drawCell(row.categoryName, currentX, y, categoryWidth, 'left')
        currentX += categoryWidth

        branchHeaders.forEach((header) => {
          const val = (row.branchSales[header] || 0).toFixed(2)
          drawCell(val, currentX, y, branchColWidth, 'right')
          currentX += branchColWidth
        })

        drawCell(row.totalQuantity.toString(), currentX, y, totalQtyWidth, 'right')
        currentX += totalQtyWidth

        drawCell(row.totalAmount.toFixed(2), currentX, y, totalAmtWidth, 'right')

        y += rowHeight
      })

      // Grand Total Row
      if (y > doc.page.height - 50) {
        doc.addPage({ layout: 'landscape', margin: 30 })
        y = 30
      }

      currentX = startX
      doc.font('Helvetica-Bold')
      drawCell('', currentX, y, sNoWidth, 'center')
      currentX += sNoWidth

      drawCell('TOTAL', currentX, y, categoryWidth, 'left', true)
      currentX += categoryWidth

      branchHeaders.forEach((header) => {
        drawCell('', currentX, y, branchColWidth, 'center')
        currentX += branchColWidth
      })

      drawCell(totals.totalQuantity.toString(), currentX, y, totalQtyWidth, 'right', true)
      currentX += totalQtyWidth

      drawCell(totals.totalAmount.toFixed(2), currentX, y, totalAmtWidth, 'right', true)

      doc.end()
    })

    return new Response(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="category_report_${startDateParam}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    payload.logger.error(error)
    return Response.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
