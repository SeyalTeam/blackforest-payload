import { MongoClient, ObjectId } from 'mongodb';

async function run() {
  const uri = process.env.DATABASE_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('blackforest-payload');
    const user = await db.collection('users').findOne({ _id: new ObjectId('6a51c3edec08231d01c3a3d1') });
    console.log(JSON.stringify(user, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
