import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import { getPayload } from 'payload'

import config from '../payload.config'
import {
  getRequestedCategoryProductPrices,
  requestedCategoryReportDate,
} from './requestedCategoryProductPricesData'

const generatePdf = async () => {
  const payload = await getPayload({ config })
  const groupedProducts = await getRequestedCategoryProductPrices(payload)

  const outputPath = path.resolve(
    process.cwd(),
    `reports/requested-category-product-price-details-${requestedCategoryReportDate}.pdf`,
  )

  const doc = new PDFDocument({
    margin: 36,
    size: 'A4',
    layout: 'landscape',
    bufferPages: true,
  })

  const stream = fs.createWriteStream(outputPath)
  doc.pipe(stream)

  const setFont = (bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
  }

  const startX = doc.page.margins.left
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const serialWidth = 50
  const priceWidth = 100
  const productWidth = usableWidth - serialWidth - priceWidth
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 24

  const addNewPage = () => {
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 })
  }

  const drawTitleBlock = () => {
    setFont(true)
    doc.fontSize(18).fillColor('#111827').text('Category Product Price Details', { align: 'center' })
    doc.moveDown(0.3)
    setFont(false)
    doc.fontSize(10).fillColor('#4b5563').text(`Generated on ${requestedCategoryReportDate}`, {
      align: 'center',
    })
    doc.moveDown(0.8)
    doc
      .fontSize(9)
      .fillColor('#374151')
      .text(
        'Requested categories: Pizza, Sandwich, Fried, Fresh Juice, Premium Dessert, Tea Cafe, Dessert',
        { align: 'center' },
      )
    doc.moveDown(1.2)
  }

  const drawCategoryHeader = (title: string, subtitle: string) => {
    const headerHeight = 34
    const y = doc.y
    doc.rect(startX, y, usableWidth, headerHeight).fill('#111827')
    setFont(true)
    doc.fontSize(12).fillColor('white').text(title, startX + 10, y + 8, {
      width: usableWidth - 20,
      align: 'left',
    })
    setFont(false)
    doc.fontSize(8).fillColor('#e5e7eb').text(subtitle, startX + 10, y + 20, {
      width: usableWidth - 20,
      align: 'left',
    })
    doc.y = y + headerHeight + 6
  }

  const drawTableHeader = () => {
    const y = doc.y
    doc.rect(startX, y, usableWidth, 22).fill('#e5e7eb')
    setFont(true)
    doc.fillColor('#111827').fontSize(9)
    doc.text('S.No', startX + 6, y + 7, { width: serialWidth - 12, align: 'center' })
    doc.text('Product Name', startX + serialWidth + 6, y + 7, {
      width: productWidth - 12,
      align: 'left',
    })
    doc.text('Price', startX + serialWidth + productWidth + 6, y + 7, {
      width: priceWidth - 12,
      align: 'right',
    })

    doc.rect(startX, y, serialWidth, 22).stroke('#9ca3af')
    doc.rect(startX + serialWidth, y, productWidth, 22).stroke('#9ca3af')
    doc.rect(startX + serialWidth + productWidth, y, priceWidth, 22).stroke('#9ca3af')
    doc.y += 22
  }

  const ensureSpace = (heightNeeded: number) => {
    if (doc.y + heightNeeded <= bottomLimit) return false
    addNewPage()
    return true
  }

  drawTitleBlock()

  groupedProducts.forEach((group, groupIndex) => {
    if (groupIndex > 0 && ensureSpace(50)) {
      drawTitleBlock()
    }

    drawCategoryHeader(
      `${group.requestedCategory} (${group.items.length} items)`,
      `Database category: ${group.actualCategory}`,
    )
    drawTableHeader()

    group.items.forEach((item, itemIndex) => {
      const textHeight = doc.heightOfString(item.productName, {
        width: productWidth - 12,
        align: 'left',
      })
      const rowHeight = Math.max(22, textHeight + 10)

      if (ensureSpace(rowHeight + 24)) {
        drawTitleBlock()
        drawCategoryHeader(
          `${group.requestedCategory} (${group.items.length} items)`,
          `Database category: ${group.actualCategory} (continued)`,
        )
        drawTableHeader()
      }

      const y = doc.y
      const fillColor = itemIndex % 2 === 0 ? '#ffffff' : '#f9fafb'
      doc.rect(startX, y, usableWidth, rowHeight).fill(fillColor)

      doc.rect(startX, y, serialWidth, rowHeight).stroke('#d1d5db')
      doc.rect(startX + serialWidth, y, productWidth, rowHeight).stroke('#d1d5db')
      doc.rect(startX + serialWidth + productWidth, y, priceWidth, rowHeight).stroke('#d1d5db')

      setFont(false)
      doc.fillColor('#111827').fontSize(9)
      doc.text(String(itemIndex + 1), startX + 6, y + 7, {
        width: serialWidth - 12,
        align: 'center',
      })
      doc.text(item.productName, startX + serialWidth + 6, y + 6, {
        width: productWidth - 12,
        align: 'left',
      })
      doc.text(item.price == null ? '-' : `${item.price}`, startX + serialWidth + productWidth + 6, y + 7, {
        width: priceWidth - 12,
        align: 'right',
      })

      doc.y += rowHeight
    })

    doc.moveDown(1)
  })

  const range = doc.bufferedPageRange()
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex++) {
    doc.switchToPage(pageIndex)
    const footerY = doc.page.height - 24
    setFont(false)
    doc.fontSize(8).fillColor('#6b7280').text(`Page ${pageIndex + 1} of ${range.count}`, 0, footerY, {
      align: 'center',
    })
  }

  doc.end()

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve())
    stream.on('error', reject)
  })

  console.log(`Wrote ${outputPath}`)
}

generatePdf()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
