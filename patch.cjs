const fs = require('fs');
const file = 'src/app/(frontend)/report-graph/page.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /opacity: activeMetricFilter === 'total' \? 1 : 0\.6/g,
  "opacity: 1, borderBottom: activeMetricFilter === 'total' ? '4px solid rgba(255,255,255,0.8)' : '4px solid transparent'"
);
code = code.replace(
  /opacity: activeMetricFilter === 'counter' \? 1 : 0\.6/g,
  "opacity: 1, borderBottom: activeMetricFilter === 'counter' ? '4px solid rgba(255,255,255,0.8)' : '4px solid transparent'"
);
code = code.replace(
  /opacity: activeMetricFilter === 'table' \? 1 : 0\.6/g,
  "opacity: 1, borderBottom: activeMetricFilter === 'table' ? '4px solid rgba(255,255,255,0.8)' : '4px solid transparent'"
);
code = code.replace(
  /opacity: activeMetricFilter === 'cancelled' \? 1 : 0\.6/g,
  "opacity: 1, borderBottom: activeMetricFilter === 'cancelled' ? '4px solid rgba(255,255,255,0.8)' : '4px solid transparent'"
);

fs.writeFileSync(file, code);
console.log('Success');
