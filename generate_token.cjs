const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function run() {
  const uri = process.env.DATABASE_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    
    const branchIdStr = '6ab55088abfb789680075389';
    const branchId = new ObjectId(branchIdStr);
    
    // Check if user exists for this branch
    let user = await db.collection('users').findOne({ branch: branchId });
    
    if (!user) {
      console.log("No user found for this branch. Creating one...");
      const result = await db.collection('users').insertOne({
        email: `branch_${branchIdStr}@bf.com`,
        role: 'branch',
        branch: branchId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      user = await db.collection('users').findOne({ _id: result.insertedId });
    }
    
    console.log(`User ID: ${user._id}`);
    console.log(`Email: ${user.email}`);
    
    // Generate token
    const secret = process.env.PAYLOAD_SECRET;
    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        collection: 'users',
      },
      secret,
      {
        expiresIn: '30d',
      }
    );
    
    console.log(`\nAPI Token for branch ${branchIdStr}:`);
    console.log(token);
    
    console.log(`\nTo add to .env, append this to BLACKFOREST_BRANCH_API_TOKENS:`);
    console.log(`,${branchIdStr}=${token}`);
    
  } finally {
    await client.close();
  }
}
run().catch(console.error);
