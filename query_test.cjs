const http = require('http');

http.get('http://localhost:3000/api/reports/raw-material-billing', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const report = JSON.parse(data);
    if (report.groups && report.groups.length > 0) {
       console.log(JSON.stringify(report.groups[0].items[0], null, 2));
    } else {
       console.log('No data');
    }
  });
});
