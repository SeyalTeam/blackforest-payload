const { MongoClient, ObjectId } = require('mongodb');
const uri = 'mongodb+srv://seyalteam_dmongob:X2f3IzZHGrVJDXo6@seyal.pkf6hae.mongodb.net/blackforest-payload?appName=Seyal';

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const bill = await db.collection('billings').findOne({ _id: new ObjectId('6a9c3160eb662956a77c1a26') });
    console.log('Bill found:', bill ? bill._id.toString() : 'No');
    
    if (bill && bill.branch) {
      const branchId = typeof bill.branch === 'object' ? bill.branch : new ObjectId(bill.branch);
      const branch = await db.collection('branches').findOne({ _id: branchId });
      console.log('Branch:', branch ? branch.name : 'Unknown');
      
      if (branch && branch.company) {
         const companyId = typeof branch.company === 'object' ? branch.company : new ObjectId(branch.company);
         const company = await db.collection('companies').findOne({ _id: companyId });
         console.log('Company:', company ? company.name + ' (' + company._id.toString() + ')' : 'Unknown');
      } else {
         console.log('No company linked to this branch.');
      }
    } else {
      console.log('No branch found for this bill.');
    }
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
