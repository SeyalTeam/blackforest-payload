const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: '6a51c3edec08231d01c3a3d1', collection: 'users' }, 'c44e148eee332356a3594a2d', { expiresIn: '1d' });
const { execSync } = require('child_process');

try {
  const result = execSync(`curl -s "https://blackforest.vseyal.com/api/attendance?where%5BdateString%5D%5Blike%5D=2026-09&limit=10" -H "Authorization: JWT ${token}"`).toString();
  console.log(result);
} catch (e) {
  console.log(e);
}
