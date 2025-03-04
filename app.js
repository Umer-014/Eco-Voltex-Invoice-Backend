require('dotenv').config(); // Load environment variables

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const invoiceRoutes = require('./routes/invoice.routes');

const app = express();
app.use(express.json());
app.use(cors());

// Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1); // Exit process if connection fails
  }
};

connectDB();

// Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

app.use('/api/invoices', invoiceRoutes);

// Start Server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
