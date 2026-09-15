const http = require('http');

async function testQuery(queryString) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000/api/reviews?limit=1&${queryString}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
  });
}

async function run() {
  const res1 = await testQuery('where[branch][in]=68fcf70eb56439f25a2dcd06,68fcf7a6b56439f25a2dcd68');
  console.log("With comma:", res1.docs ? res1.docs.length : res1);
  
  const res2 = await testQuery('where[branch][in][0]=68fcf70eb56439f25a2dcd06&where[branch][in][1]=68fcf7a6b56439f25a2dcd68');
  console.log("With array:", res2.docs ? res2.docs.length : res2);
}
run();
