process.env.DATABASE_URI = "mongodb+srv://seyalteam_dmongob:X2f3IzZHGrVJDXo6@seyal.pkf6hae.mongodb.net/blackforest-payload?appName=Seyal";
process.env.MONGODB_URI = "mongodb+srv://seyalteam_dmongob:X2f3IzZHGrVJDXo6@seyal.pkf6hae.mongodb.net/blackforest-payload?appName=Seyal";
process.env.PAYLOAD_DB_MODE = "mongo";
process.env.PAYLOAD_SECRET = "c44e148eee332356a3594a2d";
process.env.S3_ENDPOINT = "https://eb2c8ed12f807f300318e0757cb40221.r2.cloudflarestorage.com";
process.env.S3_ACCESS_KEY_ID = "f48b2bd4a43b206356a7ea87d453fca6";
process.env.S3_SECRET_ACCESS_KEY = "d07482a48fc4ebfd8685512604e51d80217961b530507c24e81c8f4c3119fac5";
process.env.S3_BUCKET = "vseyal";
process.env.S3_REGION = "auto";

async function run() {
  const { getPayload } = await import('payload');
  const configModule = await import('./src/payload.config.js');
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
  console.log(`Testing with branch user: ${branchUser.email} (ID: ${branchUser.id})`);
  
  console.log('\n--- TESTING VIA LOCAL API (WITH BRANCH USER CONTEXT) ---');

  try {
    const branches = await payload.find({
      collection: 'branches',
      limit: 1000,
      depth: 0,
      overrideAccess: false,
      user: branchUser
    });
    console.log(`api/branches: SUCCESS (found ${branches.docs.length} branches)`);
  } catch (err: any) {
    console.error(`api/branches: FAILED - ${err.message}`);
  }

  try {
    const settings = await payload.findGlobal({
      slug: 'widget-settings',
      depth: 0,
      overrideAccess: false,
      user: branchUser
    });
    console.log(`api/globals/widget-settings: SUCCESS`);
  } catch (err: any) {
    console.error(`api/globals/widget-settings: FAILED - ${err.message}`);
  }

  try {
    const appDownloads = await payload.findGlobal({
      slug: 'app-download-settings',
      depth: 1,
      overrideAccess: false,
      user: branchUser
    });
    console.log(`api/globals/app-download-settings: SUCCESS`);
  } catch (err: any) {
    console.error(`api/globals/app-download-settings: FAILED - ${err.message}`);
  }

  try {
    const waiters = await payload.find({
      collection: 'users',
      limit: 1000,
      depth: 0,
      where: {
        role: {
          equals: 'waiter'
        }
      },
      overrideAccess: false,
      user: branchUser
    });
    console.log(`api/users (waiters): SUCCESS (found ${waiters.docs.length} waiters)`);
  } catch (err: any) {
    console.error(`api/users (waiters): FAILED - ${err.message}`);
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err)
  process.exit(1)
});
