const http = require('http');

const data = JSON.stringify({
  query: `
    query AttendanceReport($filter: AttendanceReportFilterInput) {
      attendanceReport(filter: $filter) {
        items {
          employeeName
        }
      }
    }
  `,
  variables: {
    filter: {
      employee: "some_random_id_that_should_not_exist"
    }
  }
});

const req = http.request({
  hostname: 'localhost',
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
