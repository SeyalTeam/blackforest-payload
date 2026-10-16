import { MongoClient, ObjectId } from 'mongodb';

async function run() {
  const uri = process.env.DATABASE_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('blackforest-payload');
    
    const validBranchId = new ObjectId('68fcf70eb56439f25a2dcd06');
    
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId('6a51c3edec08231d01c3a3d1') },
      { 
        $set: { 
          kitchenBranches: [validBranchId],
          lastLoginBranch: validBranchId
        }
      }
    );
    console.log('Update result:', result);
    
    // Check if branch field exists and update if necessary
    const user = await db.collection('users').findOne({ _id: new ObjectId('6a51c3edec08231d01c3a3d1') });
    console.log('Updated user lastLoginBranch:', user.lastLoginBranch);
    
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
