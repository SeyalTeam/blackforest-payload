import payload from 'payload';
import config from './src/payload.config';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  await payload.init({
    secret: process.env.PAYLOAD_SECRET || 'test',
    config,
    local: true,
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const docs = await payload.find({
    collection: 'attendance',
    where: {
      and: [
        { user: { equals: '6a51c3edec08231d01c3a3d1' } },
        { dateString: { equals: todayStr } }
      ]
    }
  });

  if (docs.docs.length > 0) {
    const today = docs.docs[0];
    console.log("Present Today:", true);
    console.log("Activities:", JSON.stringify(today.activities, null, 2));
  } else {
    console.log("Present Today:", false);
    const lastDoc = await payload.find({
      collection: 'attendance',
      where: { user: { equals: '6a51c3edec08231d01c3a3d1' } },
      sort: '-date',
      limit: 1
    });
    if (lastDoc.docs.length > 0) {
      console.log("Last Attendance:", lastDoc.docs[0].dateString);
    }
  }

  const user = await payload.findByID({
    collection: 'users',
    id: '6a51c3edec08231d01c3a3d1',
  });
  console.log("User Role:", user.role);
  
  const settings = (await payload.findGlobal({
    slug: 'work-settings'
  })) as any;
  
  const roleSetting = settings.roleSettings?.find((r: any) => r.role === user.role);
  console.log("Required Work Time (hours):", roleSetting?.requiredHours || 'Not Set');

  process.exit(0);
}

check().catch(console.error);
