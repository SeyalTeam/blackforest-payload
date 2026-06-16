process.env.DATABASE_URI = "mongodb+srv://seyalteam_dmongob:X2f3IzZHGrVJDXo6@seyal.pkf6hae.mongodb.net/blackforest-payload?appName=Seyal";
process.env.MONGODB_URI = "mongodb+srv://seyalteam_dmongob:X2f3IzZHGrVJDXo6@seyal.pkf6hae.mongodb.net/blackforest-payload?appName=Seyal";
process.env.PAYLOAD_DB_MODE = "mongo";
process.env.PAYLOAD_SECRET = "c44e148eee332356a3594a2d";
process.env.S3_ENDPOINT = "https://eb2c8ed12f807f300318e0757cb40221.r2.cloudflarestorage.com";
process.env.S3_ACCESS_KEY_ID = "f48b2bd4a43b206356a7ea87d453fca6";
process.env.S3_SECRET_ACCESS_KEY = "d07482a48fc4ebfd8685512604e51d80217961b530507c24e81c8f4c3119fac5";
process.env.S3_BUCKET = "vseyal";
process.env.S3_REGION = "auto";

import jwt from 'jsonwebtoken';
import axios from 'axios';

async function run() {
  const { getPayload } = await import('payload');
  const configModule = await import('../src/payload.config');
  const config = configModule.default || configModule;

  const payload = await getPayload({ config })
  
  // Find a branch user to test
  const users = await payload.find({
    collection: 'users',
    where: {
      role: {
        equals: 'branch'
      }
    },
    limit: 1,
    depth: 0
  });

  if (users.docs.length === 0) {
    console.error('No branch user found in database');
    process.exit(1);
  }

  const branchUser = users.docs[0];
  console.log(`Branch user: ${branchUser.email} (ID: ${branchUser.id})`);

  console.log('Updating password for test user...');
  await payload.update({
    collection: 'users',
    id: branchUser.id,
    data: {
      password: 'password123'
    },
    overrideAccess: true,
  });

  const targetHost = 'https://blackforest3.vseyal.com';

  console.log('Logging in via REST API...');
  const loginRes = await axios.post(`${targetHost}/api/users/login`, {
    email: branchUser.email,
    password: 'password123',
  });

  const token = loginRes.data.token;
  console.log('Login successful! Token:', token);

  const headers = {
    'Authorization': `JWT ${token}`,
    'Content-Type': 'application/json'
  };
  
  console.log(`\n--- TESTING LOCAL REST API ENDPOINTS ---`);

  const endpoints = [
    '/api/branches?limit=1000&depth=0&sort=name',
    '/api/globals/widget-settings?depth=0',
    '/api/globals/app-download-settings?depth=1',
    '/api/users?limit=1000&depth=0&where[role][equals]=waiter'
  ];

  for (const endpoint of endpoints) {
    try {
      const url = `${targetHost}${endpoint}`;
      const res = await axios.get(url, { headers });
      console.log(`SUCCESS: ${endpoint} -> Status ${res.status}`);
      if (endpoint.includes('branches')) {
        console.log(`  Branches count: ${res.data?.docs?.length}`);
      }
      if (endpoint.includes('users/me')) {
        console.log(`  Me response data:`, JSON.stringify(res.data, null, 2));
      }
    } catch (err: any) {
      console.error(`FAILED: ${endpoint} -> Status ${err.response?.status || 'network error'} | Message: ${JSON.stringify(err.response?.data || err.message)}`);
    }
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
