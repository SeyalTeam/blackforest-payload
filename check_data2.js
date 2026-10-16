import { MongoClient, ObjectId } from 'mongodb';

async function run() {
  const uri = process.env.DATABASE_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('blackforest-payload');
    
    const user = await db.collection('users').findOne({ _id: new ObjectId('6988d07434584029a54a4faf') });
    console.log('User Document:', JSON.stringify(user, null, 2));

    const attendance = await db.collection('attendances').findOne({ _id: new ObjectId('6abf7f123ddb3cb8d4bd2b4d') });
    console.log('\nAttendance Document:', JSON.stringify(attendance, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
