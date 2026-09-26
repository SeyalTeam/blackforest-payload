const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.DATABASE_URI);

  const products = mongoose.connection.collection('products');
  const otherProducts = mongoose.connection.collection('other-products');
  const rawMaterials = mongoose.connection.collection('raw-materials');

  const p = await products.find({ name: { $regex: /marie gold/i } }).toArray();
  p.forEach(x => console.log('products:', x.name, x._id));
  
  const op = await otherProducts.find({ name: { $regex: /marie gold/i } }).toArray();
  op.forEach(x => console.log('other-products:', x.name, x._id));

  const rm = await rawMaterials.find({ name: { $regex: /marie gold/i } }).toArray();
  rm.forEach(x => console.log('raw-materials:', x.name, x._id));

  process.exit(0);
}

main().catch(console.error);
