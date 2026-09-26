import { config } from 'dotenv';
config();
import payload from 'payload';

const run = async () => {
  await payload.init({
    secret: process.env.PAYLOAD_SECRET || 'secret',
    mongoURL: process.env.DATABASE_URI,
    local: true,
  });

  const { getInventoryReport } = await import('./src/services/reports/inventory.js');
  
  const report = await getInventoryReport({
    branch: '69724ad6f91273ae0b1e121f',
    product: '6ab10b0f43c2ec7b11729b75'
  });

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
};

run().catch(console.error);
