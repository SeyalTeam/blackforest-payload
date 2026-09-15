const { MongoClient, ObjectId } = require('mongodb');
const uri = 'mongodb+srv://seyalteam_dmongob:X2f3IzZHGrVJDXo6@seyal.pkf6hae.mongodb.net/blackforest-payload?appName=Seyal';

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const user = await db.collection('users').findOne({ _id: new ObjectId('6a51c3edec08231d01c3a3d1') });
    console.log('User found:', user);
    
    if (user && user.manager_companies) {
      const companyIds = user.manager_companies.map(id => typeof id === 'object' ? id : new ObjectId(id));
      const companies = await db.collection('companies').find({ _id: { $in: companyIds } }).toArray();
      console.log('Assigned Companies:');
      companies.forEach(c => console.log('-', c.name, '(', c._id.toString(), ')'));
    } else {
      console.log('No manager_companies found for user.');
    }
    
    // Also check standard company field
    if (user && user.company) {
       const c = await db.collection('companies').findOne({ _id: new ObjectId(user.company) });
       if (c) console.log('Standard company field:', c.name);
    }
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
