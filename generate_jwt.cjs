const jwt = require('jsonwebtoken');

const token = jwt.sign({
  id: '6a51c3edec08231d01c3a3d1',
  collection: 'users'
}, 'c44e148eee332356a3594a2d', { expiresIn: '1d' });

console.log("TOKEN:", token);
