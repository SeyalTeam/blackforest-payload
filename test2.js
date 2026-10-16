import { MongoClient, ObjectId } from 'mongodb';

async function run() {
  const uri = process.env.DATABASE_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('blackforest-payload');
    const user = await db.collection('users').findOne({ _id: new ObjectId('6a51c3edec08231d01c3a3d1') });
    console.log('User kitchenBranches:', user?.kitchenBranches);
    console.log('User lastLoginBranch:', user?.lastLoginBranch);
    
    const branch = await db.collection('branches').findOne({ _id: new ObjectId('6906dc71896efbd4bc64d028') });
    console.log('Branch:', branch ? branch.name : 'NOT FOUND');
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
