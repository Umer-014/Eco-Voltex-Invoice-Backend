const jwt = require('jsonwebtoken');
module.exports = (req, res, next) => {
  try {
    const t = req.cookies?.[process.env.COOKIE_NAME];
    if (!t) return res.status(401).json({ error: { message: 'Unauthenticated' } });
    const d = jwt.verify(t, process.env.JWT_SECRET);
    req.user = { id: d.sub, role: d.role };
    next();
  } catch { return res.status(401).json({ error: { message: 'Unauthenticated' } }); }
};
