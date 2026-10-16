require('dotenv').config();
const { MongoClient } = require('mongodb');

async function run() {
  const uri = process.env.DATABASE_URI;
  if (!uri) throw new Error("No DATABASE_URI found");
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    
    const calls = await db.collection('waiter-calls').find({ billing: "6ab76d161d5a0d37bba8dbc6" }).toArray();
    console.log("waiter-calls for bill:", JSON.stringify(calls, null, 2));
    
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
