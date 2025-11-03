// Load env first
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

// --- Routes ---
const invoiceRoutes = require('./routes/invoice.routes');
const authRoutes = require('./routes/auth'); // <-- you will add this file

const app = express();

/* ---------------- Security & core middleware ---------------- */
app.use(helmet());

// Allow your React app to send/receive cookies
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());

// If behind a proxy (Railway/Render/Heroku/Nginx), trust it so secure cookies work
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

/* ---------------- Database connection ---------------- */
(async () => {
  try {
    // With Mongoose v7/8 you don't need useNewUrlParser/useUnifiedTopology
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
})();

/* ---------------- Health check ---------------- */
app.get('/api/health', (_req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

/* ---------------- Auth routes (login/logout/me) ---------------- */
// rate-limit just the login endpoint to reduce brute force
const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 5 });
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);

/* ---------------- App business routes ---------------- */
app.use('/api/invoices', invoiceRoutes);

/* ---------------- Global error fallback (optional) ---------------- */
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: { message: 'Server error' } });
});

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

const quoteRoutes = require('./routes/quote.routes');
app.use('/api/quotes', quoteRoutes);


/* ---------------- Start server ---------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
