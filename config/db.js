require('dotenv').config();  // Make sure this line is at the top

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;  // Read from .env file
    if (!mongoURI) {
      throw new Error('MongoDB URI not found in environment variables');
    }

    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
