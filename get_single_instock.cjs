const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.DATABASE_URI);

  const InstockEntryModel = mongoose.connection.collection('instock-entries');
  const productId = '6ab10b0f43c2ec7b11729b75';
  const branchId = '69724ad6f91273ae0b1e121f';

  const instockPipeline = [
    {
      $match: {
        branch: new mongoose.Types.ObjectId(branchId),
      },
    },
    { $unwind: '$items' },
    {
      $match: {
        'items.product': new mongoose.Types.ObjectId(productId),
        'items.status': 'approved',
        'items.instock': { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        totalInstock: { $sum: '$items.instock' },
      },
    },
  ];

  const instockStats = await InstockEntryModel.aggregate(instockPipeline).toArray();
  console.log('Total Instock from instock-entries:', instockStats);

  // also check other products collection to see if there is any instock entries for it
  const products = mongoose.connection.collection('products');
  const p = await products.findOne({ _id: new mongoose.Types.ObjectId(productId) });
  console.log("Product Name:", p.name);

  process.exit(0);
}

main().catch(console.error);
