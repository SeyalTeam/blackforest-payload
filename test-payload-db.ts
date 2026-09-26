import payload from 'payload';
import path from 'path';

require('dotenv').config();

const run = async () => {
  await payload.init({
    secret: process.env.PAYLOAD_SECRET || 'secret',
    mongoURL: process.env.MONGODB_URI || 'mongodb://127.0.0.1/blackforest',
    local: true,
  });

  const settings = await payload.findGlobal({
    slug: 'payment-settings',
  });
  console.log(JSON.stringify(settings, null, 2));
  process.exit(0);
};

run();
