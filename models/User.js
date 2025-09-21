const { Schema, model } = require('mongoose');
const userSchema = new Schema({
  username: { type: String, unique: true, required: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin'], default: 'admin' }
});
module.exports = model('User', userSchema);
