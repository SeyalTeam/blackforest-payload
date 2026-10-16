import { MongoClient, ObjectId } from 'mongodb';

async function run() {
  const uri = process.env.DATABASE_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('blackforest-payload');
    
    const validBranchId = new ObjectId('6ab55088abfb789680075389');
    
    // Update the specific attendance record
    const result = await db.collection('attendance').updateOne(
      { _id: new ObjectId('6abf4f443ddb3cb8d4b4626b') },
      { 
        $set: { 
          loginBranch: validBranchId
        }
      }
    );
    console.log('Update attendance result:', result);
    
    // Also update any other attendance records that might have the old broken branch ID
    const brokenBranchId = new ObjectId('6906dc71896efbd4bc64d028');
    const bulkResult = await db.collection('attendance').updateMany(
      { loginBranch: brokenBranchId },
      { 
        $set: { 
          loginBranch: validBranchId
        }
      }
    );
    console.log('Bulk update old broken attendance records result:', bulkResult);
    
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
