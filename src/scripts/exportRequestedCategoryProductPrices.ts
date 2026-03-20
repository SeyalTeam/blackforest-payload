import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '../payload.config'
import {
  getRequestedCategoryProductPrices,
  requestedCategoryReportDate,
} from './requestedCategoryProductPricesData'

const csvEscape = (value: string | number | null | undefined): string => {
  const stringValue = String(value ?? '')
  if (!/[",\n]/.test(stringValue)) {
    return stringValue
  }

  return `"${stringValue.replace(/"/g, '""')}"`
}

const run = async () => {
  const payload = await getPayload({ config })
  const groupedProducts = await getRequestedCategoryProductPrices(payload)

  const rows = [
    ['requested_category', 'actual_category', 'product_name', 'price'],
    ...groupedProducts.flatMap((group) =>
      group.items.map((item) => [
        item.requestedCategory,
        item.actualCategory,
        item.productName,
        item.price ?? '',
      ]),
    ),
  ]

  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n'
  const outputPath = path.resolve(
    process.cwd(),
    `reports/requested-category-product-price-details-${requestedCategoryReportDate}.csv`,
  )

  fs.writeFileSync(outputPath, csv)

  console.log(`Wrote ${outputPath} with ${rows.length - 1} products.`)
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
