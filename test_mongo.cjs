const { MongoClient } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb://127.0.0.1/blackforest-payload');
  try {
    await client.connect();
    const db = client.db('blackforest-payload');
    const employee = await db.collection('employees').findOne({ name: /SIGAMANI/i });
    console.log("Found:", employee);
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
