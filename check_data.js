import { MongoClient, ObjectId } from 'mongodb';

async function run() {
  const uri = process.env.DATABASE_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('blackforest-payload');
    
    const user = await db.collection('users').findOne({ _id: new ObjectId('6988d07434584029a54a4faf') });
    console.log('User Role:', user?.role);
    console.log('User isKitchen:', user?.isKitchen);
    console.log('User Branch:', user?.branch);
    console.log('User KitchenBranches:', user?.kitchenBranches);
    console.log('User LastLoginBranch:', user?.lastLoginBranch);
    
    if (user?.lastLoginBranch) {
      const branch = await db.collection('branches').findOne({ _id: user.lastLoginBranch });
      console.log('User LastLoginBranch Name:', branch?.name);
    }

    const attendance = await db.collection('attendances').findOne({ _id: new ObjectId('6abf7f123ddb3cb8d4bd2b4d') });
    console.log('\nAttendance LoginBranch:', attendance?.loginBranch);
    if (attendance?.loginBranch) {
      const branch = await db.collection('branches').findOne({ _id: attendance.loginBranch });
      console.log('Attendance LoginBranch Name:', branch?.name);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
