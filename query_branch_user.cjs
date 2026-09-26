const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function run() {
  const uri = process.env.DATABASE_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const users = await db.collection('users').find({ email: 'vseyal.team@gmail.com' }).toArray();
    console.log("Users with email vseyal.team@gmail.com:", users);
    
    // Check if there are ANY users for this branch by checking all users
    const allUsers = await db.collection('users').find({}).toArray();
    const branchUsers = allUsers.filter(u => String(u.branch) === '6ab55088abfb789680075389');
    console.log("Users linked via string branch ID:", branchUsers);
  } finally {
    await client.close();
  }
}
run().catch(console.error);
