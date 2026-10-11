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
    console.log("Bill:", JSON.stringify(bill, null, 2));

    const calls = await db.collection('waitercalls').find({ bill: new ObjectId("6ab76d161d5a0d37bba8dbc6") }).toArray();
    console.log("WaiterCalls for this bill:", JSON.stringify(calls, null, 2));
    
    // Check if there are any waiter calls for this table recently
    if (bill && bill.table) {
      const tableCalls = await db.collection('waitercalls').find({ table: bill.table, status: 'pending' }).toArray();
      console.log("Pending WaiterCalls for this table:", JSON.stringify(tableCalls, null, 2));
    }
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
