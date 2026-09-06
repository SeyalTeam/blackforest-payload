const { MongoClient } = require('mongodb');
require('dotenv').config();
async function run() {
  const client = await MongoClient.connect(process.env.DATABASE_URI);
  const db = client.db();
  const docs = await db.collection('raw-material-billings').find({ payments: { $exists: true, $not: {$size: 0} } }).limit(2).toArray();
  console.log(JSON.stringify(docs.map(d => d.payments), null, 2));
  client.close();
}
run().catch(console.dir);
