const { MongoClient } = require('mongodb');

async function run() {
  const client = new MongoClient("mongodb+srv://seyalteam_dmongob:X2f3IzZHGrVJDXo6@seyal.pkf6hae.mongodb.net/blackforest-payload?appName=Seyal");
  await client.connect();
  const db = client.db();
  const todayStr = new Date().toISOString().split('T')[0];
  console.log("Checking user 6a51c3edec08231d01c3a3d1 for date:", todayStr);
  const attendance = await db.collection('attendance').findOne({
    user: '6a51c3edec08231d01c3a3d1',
    dateString: todayStr
  });
  
  if (attendance) {
    console.log("Status: Present Today");
    let totalSec = 0;
    attendance.activities.forEach(a => {
      if(a.type === 'session') totalSec += a.durationSeconds || 0;
    });
    console.log(`Working Time: ${Math.floor(totalSec/3600)}h ${Math.floor((totalSec%3600)/60)}m`);
    console.log("Raw Activities:", JSON.stringify(attendance.activities, null, 2));
  } else {
    console.log("Status: Absent Today");
    const last = await db.collection('attendance').find({ user: '6a51c3edec08231d01c3a3d1' }).sort({ date: -1 }).limit(1).toArray();
    if(last.length) {
      console.log("Last Attendance Date:", last[0].dateString);
    }
  }

  const user = await db.collection('users').findOne({ _id: '6a51c3edec08231d01c3a3d1' });
  console.log("User Role:", user?.role);
  
  const settings = await db.collection('globals').findOne({ globalType: 'work-settings' });
  const roleSet = settings?.roleSettings?.find(r => r.role === user?.role);
  console.log("Required Work Time (hours):", roleSet?.requiredHours || 'Not set');

  await client.close();
}
run();
