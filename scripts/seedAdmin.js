require('dotenv').config();
const bcrypt = require('bcrypt');
const connectDB = require('../config/db');
const User = require('../models/User');

(async () => {
  await connectDB(process.env.MONGO_URI);

  const username = process.env.ADMIN_USERNAME;
  const plain = process.env.ADMIN_PASSWORD;

  if (await User.findOne({ username })) {
    console.log('Admin already exists');
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(plain, 12);
  await User.create({ username, passwordHash, role: 'admin' });
  console.log(`✅ Admin created: ${username}`);
  process.exit(0);
})();
