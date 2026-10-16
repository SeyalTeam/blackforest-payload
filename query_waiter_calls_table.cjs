require('dotenv').config();
const { MongoClient } = require('mongodb');

async function run() {
  const uri = process.env.DATABASE_URI;
  if (!uri) throw new Error("No DATABASE_URI found");
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    
    const calls = await db.collection('waiter-calls').find({ 
      tableNumber: "14", 
      section: "AC",
      branch: "69724ad6f91273ae0b1e121f",
      status: "pending"
    }).toArray();
    console.log("Pending waiter-calls for Table 14 AC:", JSON.stringify(calls, null, 2));
    
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
