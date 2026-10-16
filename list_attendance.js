import { MongoClient, ObjectId } from 'mongodb';

async function run() {
  const uri = process.env.DATABASE_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('blackforest-payload');
    const docs = await db.collection('attendance').find({}).sort({ _id: -1 }).limit(3).toArray();
    console.log('Recent Attendance Documents:', JSON.stringify(docs, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
