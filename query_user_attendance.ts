import payload from 'payload';
import path from 'path';

require('dotenv').config();

const start = async () => {
  await payload.init({
    secret: process.env.PAYLOAD_SECRET || 'secret',
    mongoURL: process.env.MONGODB_URI || 'mongodb://127.0.0.1/blackforest',
    local: true,
  });

  const userId = '6a51c3edec08231d01c3a3d1';
  
  // Today's date string
  const d = new Date();
  const utcOffset = d.getTime() + (5.5 * 60 * 60 * 1000);
  const localDate = new Date(utcOffset);
  const year = localDate.getUTCFullYear();
  const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(localDate.getUTCDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  console.log(`Checking attendance for User ID: ${userId} on ${todayStr}`);

  const user = await payload.findByID({
    collection: 'users',
    id: userId,
  });
  console.log(`User Name: ${user.name}`);

  const result = await payload.find({
    collection: 'attendance',
    where: {
      and: [
        { user: { equals: userId } },
        { dateString: { equals: todayStr } }
      ]
    },
    limit: 1,
  });

  if (result.docs.length > 0) {
    const doc = result.docs[0];
    console.log(`Status: PRESENT (Day Type: ${doc.dayType || 'N/A'})`);
    let totalWorkSecs = 0;
    
    if (doc.activities) {
      doc.activities.forEach((act: any) => {
        if (act.type === 'session') {
          console.log(`- Session: ${act.punchIn} to ${act.punchOut || 'Active'} (Status: ${act.status})`);
          if (act.punchIn && act.punchOut) {
            const diff = Math.floor((new Date(act.punchOut).getTime() - new Date(act.punchIn).getTime()) / 1000);
            totalWorkSecs += diff;
          } else if (act.durationSeconds) {
            totalWorkSecs += act.durationSeconds;
          } else if (act.status === 'active' && act.punchIn) {
             const diff = Math.floor((new Date().getTime() - new Date(act.punchIn).getTime()) / 1000);
             totalWorkSecs += diff;
             console.log(`  (Ongoing session: ${diff} seconds so far)`);
          }
        }
      });
    }

    const hours = Math.floor(totalWorkSecs / 3600);
    const mins = Math.floor((totalWorkSecs % 3600) / 60);
    console.log(`Total Working Hours: ${hours}h ${mins}m`);

  } else {
    console.log(`Status: ABSENT (No attendance record found for today)`);
  }

  process.exit(0);
};

start();
