import { MongoClient } from 'mongodb';

async function run() {
  const uri = process.env.DATABASE_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('blackforest-payload');
    const cols = await db.listCollections().toArray();
    console.log('Collections:', cols.map(c => c.name));
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
