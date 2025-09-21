const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const User = require('../models/User');

const router = express.Router();
const loginSchema = Joi.object({ username: Joi.string().required(), password: Joi.string().required() });

router.post('/login', async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ error: { message: 'Invalid data' } });

  const { username, password } = value;
  const user = await User.findOne({ username: username.toLowerCase() });
  if (!user) return res.status(401).json({ error: { message: 'Invalid credentials' } });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: { message: 'Invalid credentials' } });

  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '1h' });
  res.cookie(process.env.COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // set true only under HTTPS
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000
  });
  res.json({ user: { id: user._id, username: user.username, role: user.role } });
});

router.post('/logout', (req, res) => {
  res.clearCookie(process.env.COOKIE_NAME, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  try {
    const token = req.cookies?.[process.env.COOKIE_NAME];
    if (!token) return res.status(401).json({ error: { message: 'Unauthenticated' } });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ user: { id: decoded.sub, role: decoded.role } });
  } catch {
    res.status(401).json({ error: { message: 'Unauthenticated' } });
  }
});

module.exports = router;
