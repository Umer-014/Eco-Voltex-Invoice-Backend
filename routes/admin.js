const express = require('express');
const router = express.Router();

// You could add middleware here to check req.user.role === 'admin'

router.get('/secret', (req, res) => {
  res.json({ secret: 'This is the admin secret message' });
});

module.exports = router;
