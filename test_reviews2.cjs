const https = require('https');

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5NzI0YWZlZjkxMjczYWUwYjFlMTIzMiIsImNvbGxlY3Rpb24iOiJ1c2VycyIsImVtYWlsIjoiZXR0cm9hZEBiZi5jb20iLCJzaWQiOiJkOThjN2FmNS01NTAzLTRmODctODA1OS00Mjc4ZGMwOTdlZDUiLCJpYXQiOjE3ODEwOTg0ODYsImV4cCI6MTc4MzY5MDQ4Nn0.-_LafEG2c3I197Z_wBGXJ9CPUAqBXXmJAZttT206ONk";

const options3 = {
  hostname: 'dev1-blacforest.vseyal.com',
  path: '/api/reviews?limit=1',
  headers: { 'Authorization': `Bearer ${token}` }
};

https.get(options3, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Total without filter:', JSON.parse(data).totalDocs));
});
