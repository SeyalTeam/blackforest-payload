import { MongoClient } from 'mongodb';

async function run() {
  const uri = process.env.DATABASE_URI || 'mongodb://127.0.0.1/blackforest';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('blackforest');
    const user = await db.collection('users').findOne({ _id: '6a51c3edec08231d01c3a3d1' });
    console.log('User:', user);
  } finally {
    await client.close();
  }
}
run();
