const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run() {
  const uri = process.env.DATABASE_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    
    const users = await db.collection('users').find({}).toArray();
    console.log("All branch IDs mapped to emails:");
    for (const u of users) {
      if (u.branch) {
        console.log(`Branch: ${u.branch}, Email: ${u.email}, UserID: ${u._id}`);
      }
    }
  } finally {
    await client.close();
  }
}
run().catch(console.error);
