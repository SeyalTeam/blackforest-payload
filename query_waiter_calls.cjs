require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

async function run() {
  const uri = process.env.DATABASE_URI;
  if (!uri) throw new Error("No DATABASE_URI found");
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const calls = await db.collection('waiter_calls').find({ billing: new ObjectId("6ab76d161d5a0d37bba8dbc6") }).toArray();
    console.log("waiter_calls:", JSON.stringify(calls, null, 2));
    
    // Also check waitercalls
    const calls2 = await db.collection('waitercalls').find({ billing: new ObjectId("6ab76d161d5a0d37bba8dbc6") }).toArray();
    console.log("waitercalls:", JSON.stringify(calls2, null, 2));

    const calls3 = await db.collection('waiter-calls').find({ billing: new ObjectId("6ab76d161d5a0d37bba8dbc6") }).toArray();
    console.log("waiter-calls:", JSON.stringify(calls3, null, 2));
    
    const allCollections = await db.listCollections().toArray();
    console.log("All collections:", allCollections.map(c => c.name).filter(n => n.includes('waiter')));
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
