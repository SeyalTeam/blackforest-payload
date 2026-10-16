import { MongoClient, ObjectId } from 'mongodb';

async function run() {
  const uri = process.env.DATABASE_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('blackforest-payload');
    const doc = await db.collection('attendance').findOne({ _id: new ObjectId('6abf4f443ddb3cb8d4b4626b') });
    console.log('Attendance Document:', doc);
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
