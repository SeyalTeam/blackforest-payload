import { MongoClient, ObjectId } from 'mongodb';

async function run() {
  const uri = process.env.DATABASE_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('blackforest-payload');
    const user = await db.collection('users').findOne({ _id: new ObjectId('6a51c3edec08231d01c3a3d1') });
    console.log('User kitchens:', user?.kitchen);
    
    if (user?.kitchen && user.kitchen.length > 0) {
      const kitchenId = user.kitchen[0];
      const kitchen = await db.collection('kitchens').findOne({ _id: new ObjectId(kitchenId) });
      console.log('Kitchen:', kitchen?.name);
      console.log('Kitchen Branches:', kitchen?.branches);
      if (kitchen?.branches && kitchen.branches.length > 0) {
        const branches = await db.collection('branches').find({ _id: { $in: kitchen.branches.map(b => new ObjectId(b)) } }).toArray();
        branches.forEach(b => console.log(`  - ${b.name} (ID: ${b._id})`));
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
