import fs from 'fs'

const file = 'src/services/reports/branchBilling.ts'
let content = fs.readFileSync(file, 'utf8')
const newTrendLogic = fs.readFileSync('new-trend-logic.ts', 'utf8')

const startMarker = `  // Calculate Sales Trend based on Selected Period`
const endMarker = `  const nonZeroSales = trendData.map((s) => s.totalAmount).filter((a) => a > 0)`

const startIndex = content.indexOf(startMarker)
const endIndex = content.indexOf(endMarker)

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find markers")
  process.exit(1)
}

const newContent = content.substring(0, startIndex) + newTrendLogic + content.substring(endIndex)

fs.writeFileSync(file, newContent)
console.log("Done replacing")
