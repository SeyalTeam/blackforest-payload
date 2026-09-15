const https = require('https');
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5NzI0YWZlZjkxMjczYWUwYjFlMTIzMiIsImNvbGxlY3Rpb24iOiJ1c2VycyIsImVtYWlsIjoiZXR0cm9hZEBiZi5jb20iLCJzaWQiOiJkOThjN2FmNS01NTAzLTRmODctODA1OS00Mjc4ZGMwOTdlZDUiLCJpYXQiOjE3ODEwOTg0ODYsImV4cCI6MTc4MzY5MDQ4Nn0.-_LafEG2c3I197Z_wBGXJ9CPUAqBXXmJAZttT206ONk";

const options = {
  hostname: 'dev1-blacforest.vseyal.com',
  path: '/api/billings?where%5BcreatedAt%5D%5Bgreater_than_equal%5D=2026-09-13T18:30:00.000Z&where%5BcreatedAt%5D%5Bless_than_equal%5D=2026-09-14T18:29:59.999Z&where%5Bstatus%5D%5Bequals%5D=completed&limit=5&sort=createdAt',
  headers: { 'Authorization': `Bearer ${token}` }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const docs = JSON.parse(data).docs || [];
    docs.forEach(d => console.log('Bill:', d.invoiceNumber, 'Created:', d.createdAt));
  });
});
