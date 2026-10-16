import { MongoClient, ObjectId } from 'mongodb';

async function run() {
  const uri = process.env.DATABASE_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('blackforest-payload');
    
    const validBranchId = new ObjectId('6ab55088abfb789680075389');
    
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
    
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
