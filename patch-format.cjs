const fs = require('fs')
const file = 'src/app/(frontend)/report-graph/page.tsx'
let content = fs.readFileSync(file, 'utf8')

content = content.replace(/\{\(totals\.totalAmount\/1000\)\.toFixed\(1\)\}k/g, "{totals.totalAmount.toLocaleString('en-IN')}")
content = content.replace(/\{\(totals\.nonTableOrderAmount\/1000\)\.toFixed\(1\)\}k/g, "{totals.nonTableOrderAmount.toLocaleString('en-IN')}")
content = content.replace(/\{\(totals\.tableOrderAmount\/1000\)\.toFixed\(1\)\}k/g, "{totals.tableOrderAmount.toLocaleString('en-IN')}")
content = content.replace(/\(val\/1000\)\.toFixed\(0\)\}k/g, "val.toLocaleString('en-IN')}")
content = content.replace(/\{\(b\.total\/1000\)\.toFixed\(1\)\}k/g, "{b.total.toLocaleString('en-IN')}")

fs.writeFileSync(file, content)
