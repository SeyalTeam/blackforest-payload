import { MongoClient, ObjectId } from 'mongodb';

async function run() {
  const uri = process.env.DATABASE_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('blackforest-payload');
    const branches = await db.collection('branches').find({}).limit(5).toArray();
    console.log('Available Branches:');
    branches.forEach(b => console.log(`- ${b.name} (ID: ${b._id})`));
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
