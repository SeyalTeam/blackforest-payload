const http = require('http');

const data = JSON.stringify({
  query: `
    query {
      attendanceReport(filter: { employee: "all" }) {
        items {
          employeeName
          employeeLoginTime
          employeeLogoutTime
          employeeWorkingHours
        }
      }
    }
  `
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(body));
});
req.write(data);
req.end();
