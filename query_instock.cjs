const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.DATABASE_URI);

  const instockEntries = mongoose.connection.collection('instock-entries');
  const productId = '6ab10b0f43c2ec7b11729b75';
  const branchId = '69724ad6f91273ae0b1e121f';

  const documents = await instockEntries.find({
    $or: [
      { branch: branchId },
      { branch: new mongoose.Types.ObjectId(branchId) }
    ]
  }).toArray();

  let totalInstock = 0;
  documents.forEach(doc => {
    if (doc.items && Array.isArray(doc.items)) {
      doc.items.forEach(item => {
        const itemProd = String(item.product);
        if (itemProd === productId) {
          totalInstock += Number(item.quantity || item.receivedQuantity || item.instockQuantity || item.count || 0);
        }
      });
    }
  });

  console.log('Total instock for MARIE GOLD 30:', totalInstock);

  process.exit(0);
}

main().catch(console.error);
