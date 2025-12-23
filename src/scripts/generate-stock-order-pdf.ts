import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function generatePDF() {
  const payload = await getPayload({ config })

  const invoiceNumber = 'ETT-STC-251221-03'
  const order = await payload.find({
    collection: 'stock-orders',
    where: {
      invoiceNumber: {
        equals: invoiceNumber,
      },
    },
    depth: 2,
  })

  if (order.docs.length === 0) {
    console.log('Order not found')
    process.exit(1)
  }

  const docData = order.docs[0]
  const branchName =
    typeof docData.branch === 'object' && docData.branch !== null
      ? (docData.branch as { name?: string }).name
      : 'Unknown Branch'

  console.log(`Generating PDF for ${invoiceNumber} (${branchName})...`)

  const reportsDir = path.join(process.cwd(), 'reports')
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir)
  }

  const pdfPath = path.join(reportsDir, `${invoiceNumber}.pdf`)
  const doc = new PDFDocument({ margin: 50 })
  const writeStream = fs.createWriteStream(pdfPath)
  doc.pipe(writeStream)

  // Header
  doc.fontSize(20).text('STOCK ORDER REPORT', { align: 'center' })
  doc.moveDown()
  doc.fontSize(12).text(`Invoice Number: ${docData.invoiceNumber}`)
  doc.text(`Branch: ${branchName}`)
  doc.text(`Status: ${docData.status?.toUpperCase()}`)
  doc.text(`Delivery Date: ${new Date(docData.deliveryDate).toLocaleDateString()}`)
  doc.text(`Created At: ${new Date(docData.createdAt).toLocaleString()}`)
  doc.moveDown()

  // Headers and helper
  const itemCodeX = 50
  const descriptionX = 100
  const requiredX = 350
  const sendingX = 400
  const confirmedX = 450
  const pickedX = 500

  const drawHeader = (yPos: number) => {
    doc.fontSize(10).font('Helvetica-Bold')
    doc.text('S.No', itemCodeX, yPos)
    doc.text('Product Name', descriptionX, yPos)
    doc.text('Req', requiredX, yPos)
    doc.text('Snd', sendingX, yPos)
    doc.text('Con', confirmedX, yPos)
    doc.text('Pic', pickedX, yPos)
    doc
      .moveTo(50, yPos + 12)
      .lineTo(550, yPos + 12)
      .stroke()
    return yPos + 20
  }

  interface StockOrderItem {
    name: string
    requiredQty?: number | null
    sendingQty?: number | null
    confirmedQty?: number | null
    pickedQty?: number | null
  }

  // Group by category
  const categoriesMap: { [key: string]: StockOrderItem[] } = {}
  for (const item of docData.items || []) {
    const product = item.product as unknown as { category?: { name?: string } }
    const catName = product?.category?.name || 'Uncategorized'
    if (!categoriesMap[catName]) categoriesMap[catName] = []
    categoriesMap[catName].push(item)
  }

  let y = 220
  y = drawHeader(y)

  doc.font('Helvetica')

  let globalIndex = 1
  const sortedCatNames = Object.keys(categoriesMap).sort()

  for (const catName of sortedCatNames) {
    if (y > 700) {
      doc.addPage()
      y = 50
      y = drawHeader(y)
    }

    // Category Header
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#2c3e50')
    doc.text(catName.toUpperCase(), itemCodeX, y)
    doc.fillColor('black')
    y += 18

    const items = categoriesMap[catName].sort((a, b) => a.name.localeCompare(b.name))
    for (const item of items) {
      if (y > 750) {
        doc.addPage()
        y = 50
        y = drawHeader(y)
      }
      doc.font('Helvetica').fontSize(9)
      doc.text(globalIndex.toString(), itemCodeX, y)
      doc.text(item.name || 'N/A', descriptionX, y, { width: 240 })
      doc.text((item.requiredQty || 0).toString(), requiredX, y)
      doc.text((item.sendingQty || 0).toString(), sendingX, y)
      doc.text((item.confirmedQty || 0).toString(), confirmedX, y)
      doc.text((item.pickedQty || 0).toString(), pickedX, y)
      y += 15
      globalIndex++
    }
    y += 15 // Space between categories
  }

  doc.end()

  writeStream.on('finish', () => {
    console.log(`Successfully generated PDF: ${pdfPath}`)
    process.exit(0)
  })
}

generatePDF().catch((err) => {
  console.error('Error generating PDF:', err)
  process.exit(1)
})
