const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hostel_management';

  try {
    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize: process.env.VERCEL ? 10 : 50,
      minPoolSize: process.env.VERCEL ? 1 : 5,
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      console.warn('[Database] MongoDB connection disconnected. Attempting reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      isConnected = true;
      console.log('[Database] MongoDB reconnected successfully.');
    });

    mongoose.connection.on('error', (err) => {
      console.error('[Database] MongoDB runtime error:', err.message);
    });

    return conn;
  } catch (error) {
    isConnected = false;
    console.error(`Database Connection Error: ${error.message}`);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw error;
  }
};

module.exports = connectDB;

