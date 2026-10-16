import payload from 'payload';
import config from './src/payload.config';

async function run() {
  await payload.init({
    config,
    local: true,
  });

  const branch = await payload.findByID({
    collection: 'branches',
    id: '6906dc71896efbd4bc64d028'
  }).catch(e => console.log('Branch not found:', e.message));

  console.log('Branch:', branch);
  
  const user = await payload.findByID({
    collection: 'users',
    id: '6a51c3edec08231d01c3a3d1'
  }).catch(e => console.log('User not found:', e.message));
  
  console.log('User:', JSON.stringify(user, null, 2));
  
  process.exit(0);
}

run();
