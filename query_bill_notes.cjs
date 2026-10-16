require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

async function run() {
  const uri = process.env.DATABASE_URI;
  if (!uri) throw new Error("No DATABASE_URI found");
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const bill = await db.collection('billings').findOne({ _id: new ObjectId("6ab76d161d5a0d37bba8dbc6") });
    console.log("Bill notes:", bill?.notes);
    console.log("Bill status:", bill?.status);
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
