import { MongoClient, ObjectId } from 'mongodb';

async function run() {
  const uri = process.env.DATABASE_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('blackforest-payload');
    const branches = await db.collection('branches').find({}).toArray();
    
    // User punched in at 8.7844467, 78.1341366
    const userLat = 8.7844467;
    const userLng = 78.1341366;
    
    console.log('User punched in at:', userLat, userLng);
    
    // Simple distance calculation just to see which branch is closest
    branches.forEach(b => {
      if (b.latitude && b.longitude) {
        const dLat = (b.latitude - userLat) * (Math.PI / 180);
        const dLon = (b.longitude - userLng) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(userLat * (Math.PI / 180)) * Math.cos(b.latitude * (Math.PI / 180)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = 6371 * c * 1000; // in meters
        if (distance < 5000) {
          console.log(`Branch ${b.name} is ${distance.toFixed(2)} meters away.`);
        }
      }
    });
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
