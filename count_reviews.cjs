const { MongoClient, ObjectId } = require('mongodb');
const uri = 'mongodb+srv://seyalteam_dmongob:X2f3IzZHGrVJDXo6@seyal.pkf6hae.mongodb.net/blackforest-payload?appName=Seyal';

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const count2 = await db.collection('reviews').countDocuments({ branch: new ObjectId('68fcf70eb56439f25a2dcd06') });
    console.log("Count with ObjectId:", count2);
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
