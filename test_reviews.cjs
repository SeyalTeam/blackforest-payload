const https = require('https');

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5NzI0YWZlZjkxMjczYWUwYjFlMTIzMiIsImNvbGxlY3Rpb24iOiJ1c2VycyIsImVtYWlsIjoiZXR0cm9hZEBiZi5jb20iLCJzaWQiOiJkOThjN2FmNS01NTAzLTRmODctODA1OS00Mjc4ZGMwOTdlZDUiLCJpYXQiOjE3ODEwOTg0ODYsImV4cCI6MTc4MzY5MDQ4Nn0.-_LafEG2c3I197Z_wBGXJ9CPUAqBXXmJAZttT206ONk";

// Try comma-separated
const options = {
  hostname: 'dev1-blacforest.vseyal.com',
  path: '/api/reviews?limit=1&where[branch][in]=68fcf70eb56439f25a2dcd06,68fcf7a6b56439f25a2dcd68',
  headers: { 'Authorization': `Bearer ${token}` }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Comma separated:', JSON.parse(data).totalDocs));
});

// Try array syntax
const options2 = {
  hostname: 'dev1-blacforest.vseyal.com',
  path: '/api/reviews?limit=1&where[branch][in][0]=68fcf70eb56439f25a2dcd06&where[branch][in][1]=68fcf7a6b56439f25a2dcd68',
  headers: { 'Authorization': `Bearer ${token}` }
};

https.get(options2, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Array syntax:', JSON.parse(data).totalDocs));
});
