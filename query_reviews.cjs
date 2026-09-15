const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://seyalteam_dmongob:X2f3IzZHGrVJDXo6@seyal.pkf6hae.mongodb.net/blackforest-payload?appName=Seyal';

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const reviews = await db.collection('reviews').find({}).limit(5).toArray();
    console.log(JSON.stringify(reviews.map(r => ({ _id: r._id, branch: r.branch })), null, 2));
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
